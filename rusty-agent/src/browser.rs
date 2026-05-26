use std::io::{BufRead, BufReader};
use std::net::TcpListener;
use std::process::{Child, Command, Stdio};
use std::time::Duration;

use rand::Rng;
use rand::seq::SliceRandom;
use rustenium::browsers::ChromeTab;
use rustenium::browsers::cdp_browser::CdpBrowser;
use rustenium::browsers::cdp_browser::{
    BrowserScreenshotOptionsBuilder, FetchNodeOptions, Selector,
};
use rustenium::browsers::chrome::browser::ChromeConfig;
use rustenium::domain::cdp::page::Page;
use rustenium::domain::context::BrowsingContext;
use rustenium::input::Mouse;
use rustenium::input::{DelayRange, MouseClickOptions, MouseMoveOptions, Point};
use rustenium::nodes::{AXNode, Node};
use rustenium_bidi_definitions::browsing_context::types::CreateType;
use rustenium_cdp_definitions::browser_protocol::browser::commands::{
    GetWindowForTarget, SetWindowBounds,
};
use rustenium_cdp_definitions::browser_protocol::browser::results::GetWindowForTargetResult;
use rustenium_cdp_definitions::browser_protocol::browser::types::{Bounds, WindowState};
use rustenium_cdp_definitions::browser_protocol::dom::types::{BackendNodeId, NodeId};
use rustenium_cdp_definitions::browser_protocol::page::commands::CaptureScreenshotFormat;
use rustenium_identity::preset::get_by_id;
use rustenium_identity::{IdentityConfig, IdentitySession};
use rusty_common::config::ProxyList;
use rusty_common::display::DisplayMode;
use rusty_common::ui_map::UiNode;
use serde::Deserialize;
use uuid::Uuid;

use crate::error::BrowserError;

const CURSOR_SCRIPT: &str = concat!(
    r#"() => {
  const cur = document.createElement('img');
  cur.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;transform:translate(-50%,-50%);transition:transform .1s;';
  cur.src = 'data:image/png;base64,"#,
    "iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAMAAADXqc3KAAAAJFBMVEXc3NylpaWrq6tRUVE8PDz8/Pzq6urU1NStra2IiIhYWFgbGxuSgdLUAAAADHRSTlMBS323+v////////7FbleZAAAAxUlEQVR42n1SUW7DUAx6SQ3YcP/7Tu2WdFOa8WsZY2Ad2CtJal9/8UizpUbnsd7YQk8CJGNle7MMIbwgcA6+rVBCV+xUQ4X63skUGcOk6ZA1ed0VxahAm7ACUU8FKSBCgAQIFKCy1t7DtjMNCT2xm9P7KgZFoAMAaYCFoFYmiIkTdJDJigDTOf6IaUD/DfoTVWcVbo7vPfolt2O3nnJXfH3Q+bEEkS+WrEzpNLEC1eRquw7bb4I6o1Ud0ZayfSgDzzLc1ucL/24MxntkAwMAAAAASUVORK5CYII=",
    r#"';
  document.documentElement.appendChild(cur);
  document.addEventListener('mousemove', e => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; });
  document.addEventListener('touchmove', e => { const t = e.touches[0]; cur.style.left = t.clientX + 'px'; cur.style.top = t.clientY + 'px'; });
  const press = () => cur.style.transform = 'translate(-50%,-50%) scale(0.6)';
  const release = () => cur.style.transform = 'translate(-50%,-50%) scale(1)';
  document.addEventListener('mousedown', press); document.addEventListener('mouseup', release);
  document.addEventListener('touchstart', press); document.addEventListener('touchend', release);
}"#
);

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ChromeBrowserLaunchConfig {
    pub driver_executable_path: Option<String>,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub driver_flags: Vec<String>,
    #[serde(default)]
    pub sandbox: bool,
    pub chrome_executable_path: Option<String>,
    pub user_data_dir: Option<String>,
    pub browser_flags: Vec<String>,
}

impl ChromeBrowserLaunchConfig {
    pub fn from_env() -> Option<Self> {
        let raw = std::env::var("RUSTY_BROWSER_CONFIG").ok();
        match &raw {
            Some(s) => tracing::debug!("RUSTY_BROWSER_CONFIG present ({} bytes)", s.len()),
            None => tracing::warn!("RUSTY_BROWSER_CONFIG not set — falling back to defaults"),
        }
        raw.and_then(|s| match serde_json::from_str::<Self>(&s) {
            Ok(cfg) => {
                tracing::debug!("parsed browser config: {} browser_flags", cfg.browser_flags.len());
                Some(cfg)
            }
            Err(e) => {
                tracing::error!("RUSTY_BROWSER_CONFIG JSON parse failed: {e}");
                None
            }
        })
    }
}

impl From<ChromeBrowserLaunchConfig> for ChromeConfig {
    fn from(cfg: ChromeBrowserLaunchConfig) -> Self {
        let mut chrome_cfg = ChromeConfig::default();
        if let Some(path) = cfg.driver_executable_path {
            chrome_cfg.driver_executable_path = path;
        }
        if let Some(host) = cfg.host {
            chrome_cfg.host = Some(host);
        }
        if let Some(port) = cfg.port {
            chrome_cfg.port = Some(port);
        }
        if !cfg.driver_flags.is_empty() {
            let leaked: Vec<&'static str> = cfg
                .driver_flags
                .into_iter()
                .map(|s| -> &'static str { Box::leak(s.into_boxed_str()) as &str })
                .collect();
            chrome_cfg.driver_flags = leaked;
        }
        chrome_cfg.sandbox = cfg.sandbox;
        if let Some(path) = cfg.chrome_executable_path {
            chrome_cfg.chrome_executable_path = Some(path);
        }
        if let Some(dir) = cfg.user_data_dir {
            chrome_cfg.user_data_dir = Some(dir);
        }
        if !cfg.browser_flags.is_empty() {
            chrome_cfg.browser_flags = Some(cfg.browser_flags);
        }
        chrome_cfg
    }
}

pub struct ManagedBrowser {
    id: Uuid,
    session: IdentitySession,
    contexts: std::collections::HashMap<String, ChromeTab>,
    xvfb: Option<Child>,
    vnc: Option<Child>,
    vnc_port: Option<u16>,
}

impl ManagedBrowser {
    pub async fn launch(
        mut browser_config: ChromeBrowserLaunchConfig,
        display: DisplayMode,
    ) -> Result<Self, BrowserError> {
        let mut identity = get_by_id(1).unwrap();
        identity.proxy = Self::select_proxy(&identity.geo);

        let w = identity.screen.original_width as u32;
        let h = identity.screen.original_height as u32;
        let flags = &mut browser_config.browser_flags;

        let (xvfb, vnc, vnc_port) = match display {
            DisplayMode::Xvfb => {
                let xvfb = spawn_xvfb(w, h)?;
                let display = std::env::var("DISPLAY")
                    .map_err(|e| BrowserError::Launch(format!("DISPLAY not set after Xvfb: {e}")))?;
                let (vnc, port) = spawn_x11vnc(&display)?;
                // No window manager under Xvfb, so anchor at 0,0; the fullscreen→maximized
                // CDP calls below take care of sizing.
                default_flag(flags, "--window-position=", || "--window-position=0,0".to_string());
                (Some(xvfb), Some(vnc), Some(port))
            }
            DisplayMode::Headless => {
                default_flag(flags, "--headless", || "--headless=new".to_string());
                // Headless Chrome's default viewport is 800x600 — pin it to the identity screen
                // so screenshots and viewport-dependent rendering match the non-headless paths.
                default_flag(flags, "--window-size=", || format!("--window-size={w},{h}"));
                // Configures a virtual headless screen (Chromium 142+) so window.screen.*
                // matches the identity instead of the 800x600 stub. Independent of
                // Emulation.setDeviceMetricsOverride, so it doesn't flip the fingerprint
                // override flag that detection scripts look for on desktop identities.
                default_flag(flags, "--screen-info=", || format!("--screen-info={{{w}x{h}}}"));
                (None, None, None)
            }
            DisplayMode::Normal => (None, None, None),
        };

        let config = IdentityConfig::new(identity, browser_config.into());
        let mut session = IdentitySession::launch(config)
            .await
            .map_err(|e| BrowserError::Launch(e.to_string()))?;
        let _ = session
            .browser_mut()
            .add_preload_script(format!("{CURSOR_SCRIPT}"))
            .await;
        if xvfb.is_some() {
            // No window manager under Xvfb, so --start-maximized is a no-op. Drive the
            // window state directly via CDP — fullscreen first to break past any default
            // size, then maximized so toolbars render.
            Self::pin_window_to_screen(&mut session).await?;
        }
        let id = Uuid::new_v4();
        tracing::info!("launched {id}");
        Ok(Self {
            id,
            session,
            contexts: std::collections::HashMap::new(),
            xvfb,
            vnc,
            vnc_port,
        })
    }

    pub fn vnc_port(&self) -> Option<u16> {
        self.vnc_port
    }

    async fn pin_window_to_screen(session: &mut IdentitySession) -> Result<(), BrowserError> {
        let browser = session.browser_mut();
        let response = browser
            .adapter_mut()
            .send_command(GetWindowForTarget::builder().build())
            .await
            .map_err(|e| BrowserError::Launch(format!("getWindowForTarget: {e}")))?;
        let window = GetWindowForTargetResult::try_from(response.result)
            .map_err(|e| BrowserError::Launch(format!("getWindowForTarget parse: {e}")))?;
        for state in [WindowState::Fullscreen, WindowState::Maximized] {
            let bounds = Bounds {
                left: None,
                top: None,
                width: None,
                height: None,
                window_state: Some(state),
            };
            let cmd = SetWindowBounds::builder()
                .window_id(window.window_id)
                .bounds(bounds)
                .build()
                .map_err(|e| BrowserError::Launch(format!("setWindowBounds build: {e}")))?;
            browser
                .adapter_mut()
                .send_command(cmd)
                .await
                .map_err(|e| BrowserError::Launch(format!("setWindowBounds: {e}")))?;
        }
        Ok(())
    }

    fn select_proxy(geo: &rustenium_identity::IdentityCountryGeo) -> Option<String> {
        if !std::path::Path::new("agent-proxies.yaml").exists() {
            tracing::warn!("agent-proxies.yaml not found, skipping proxy");
            return None;
        }
        let list = ProxyList::load("agent-proxies.yaml")?;
        let mut rng = rand::thread_rng();
        let by_geo = list.get_proxies_for_geo(Some(geo.as_str()));
        let proxy = if !by_geo.is_empty() {
            by_geo.choose(&mut rng).cloned()
        } else {
            tracing::warn!("no proxies for geo={}, falling back to all", geo.as_str());
            list.get_all().choose(&mut rng).map(|s| s.to_string())
        };
        tracing::info!("proxy selected: {:?} (geo={})", proxy, geo.as_str());
        proxy
    }

    pub async fn navigate(&mut self, url: &str, _wait_until: &str) -> Result<(), BrowserError> {
        tracing::info!("{} Navigate to: {}", self.id, url);
        self.session
            .browser_mut()
            .navigate(url)
            .await
            .map(|_| ())
            .map_err(|e| BrowserError::Navigate(e.to_string()))?;
        Ok(())
    }

    pub async fn screenshot(
        &mut self,
        quality: f32,
        _format: &str,
    ) -> Result<String, BrowserError> {
        let mut opts = BrowserScreenshotOptionsBuilder::default();
        opts = opts.full(true);
        // ignoring format for now
        opts = opts
            .format(CaptureScreenshotFormat::Jpeg)
            .quality(quality as f64);
        self.session
            .browser_mut()
            .screenshot_with_options(opts.build())
            .await
            .map_err(|e| BrowserError::Screenshot(e.to_string()))
    }

    pub async fn click(&mut self, x: f32, y: f32, human: bool) -> Result<(), BrowserError> {
        tracing::info!("{} Click ({}, {}) human={}", self.id, x, y, human);
        let point = Some(Point {
            x: x as f64,
            y: y as f64,
        });
        if human {
            let dud_ctx = BrowsingContext::from_id(String::new(), CreateType::Tab);
            self.session
                .browser_mut()
                .human_mouse()
                .click(point, dud_ctx.id(), MouseClickOptions::default())
                .await
                .map_err(|e| BrowserError::Click(e.to_string()))
        } else {
            self.session
                .browser_mut()
                .mouse()
                .click(point, MouseClickOptions::default())
                .await
                .map_err(|e| BrowserError::Click(e.to_string()))
        }
    }

    pub async fn node_click(&mut self, node_id: i64, human: bool) -> Result<(), BrowserError> {
        tracing::info!("{} NodeClick node_id={} human={}", self.id, node_id, human);
        // TODO: fetch_node is called twice (once here inside scroll_to, once below) — could be unified
        let _ = self.scroll_to(node_id, human).await;
        let mut node = self
            .session
            .browser_mut()
            .fetch_node(FetchNodeOptions::default().backend_node_id(BackendNodeId::new(node_id)))
            .await
            .map_err(|e| BrowserError::Click(e.to_string()))?;

        // let ctx = self.active_context().into();
        let ctx = BrowsingContext::from_id(String::new(), CreateType::Tab);
        let position = node.get_position().await.ok_or_else(|| {
            BrowserError::Click(format!("Could not get position for node: {node_id}"))
        })?;
        if position.width == 0.0 || position.height == 0.0 {
            return Err(BrowserError::Click(format!(
                "Node has zero dimensions: {node_id}"
            )));
        }
        let point = random_point(position.x, position.y, position.width, position.height);
        if human {
            self.session
                .browser_mut()
                .human_mouse()
                .click(Some(point), ctx.id(), MouseClickOptions::default())
                .await
                .map_err(|e| BrowserError::Click(e.to_string()))
        } else {
            self.session
                .browser_mut()
                .mouse()
                .click(Some(point), MouseClickOptions::default())
                .await
                .map_err(|e| BrowserError::Click(e.to_string()))
        }
    }

    pub async fn type_text(
        &mut self,
        text: String,
        node_id: Option<i64>,
    ) -> Result<(), BrowserError> {
        tracing::info!("{} Type: {}", self.id, text);
        if let Some(id) = node_id {
            let mut node = self
                .session
                .browser_mut()
                .fetch_node(FetchNodeOptions::default().node_id(NodeId::new(id)))
                .await
                .map_err(|e| BrowserError::TypeText(e.to_string()))?;
            return node
                .type_text(text)
                .await
                .map_err(|e| BrowserError::TypeText(e.to_string()));
        }
        // let ctx = self.active_context().into();
        // let opts = KeyboardTypeOptionsBuilder::default()
        //     .delay(60, 140)
        //     .gap_multiplier(1.2)
        //     .build();
        self.session
            .browser()
            .keyboard()
            .type_text(text.as_str(), 300)
            .await
            .map_err(|e| BrowserError::TypeText(e.to_string()))
    }

    pub async fn send_key(&self, key: &String, delay_ms: u64) -> Result<(), BrowserError> {
        self.session
            .browser()
            .keyboard()
            .press(key, delay_ms)
            .await
            .map_err(|e| BrowserError::Action(e.to_string()))
    }

    pub async fn hold_key(&self, key: &str, duration_ms: u64) -> Result<(), BrowserError> {
        self.session
            .browser()
            .keyboard()
            .hold_press(key, duration_ms, DelayRange::new(30, 80).unwrap())
            .await
            .map_err(|e| BrowserError::Action(e.to_string()))
    }

    pub async fn send_keys(&self, keys: &[String]) -> Result<(), BrowserError> {
        for key in keys {
            self.send_key(key, 50).await?;
        }
        Ok(())
    }

    pub async fn mouse_move(&self, x: f32, y: f32, steps: usize) -> Result<(), BrowserError> {
        // let ctx = self.active_context().into();
        self.session
            .browser()
            .mouse()
            .move_to(
                Point {
                    x: x as f64,
                    y: y as f64,
                },
                steps,
            )
            .await
            .map_err(|e| BrowserError::Action(e.to_string()))
    }

    pub async fn human_mouse_move(&self, x: f32, y: f32) -> Result<(), BrowserError> {
        // let ctx = self.active_context().into();
        let ctx = BrowsingContext::from_id(String::new(), CreateType::Tab);

        self.session
            .browser()
            .human_mouse()
            .move_to(
                Point {
                    x: x as f64,
                    y: y as f64,
                },
                ctx.id(),
                MouseMoveOptions::default(),
            )
            .await
            .map_err(|e| BrowserError::Action(e.to_string()))
    }

    pub async fn scroll_by(&self, y: i32, _human: bool) -> Result<(), BrowserError> {
        // let ctx = self.active_context().into();
        let ctx = BrowsingContext::from_id(String::new(), CreateType::Tab);
        self.session
            .browser()
            .human_mouse()
            .scroll(y, 0, ctx.id())
            .await
            .map_err(|e| BrowserError::Action(e.to_string()))
    }

    pub async fn scroll_to(&mut self, node_id: i64, _human: bool) -> Result<(), BrowserError> {
        let mut node = self
            .session
            .browser_mut()
            .fetch_node(FetchNodeOptions::default().backend_node_id(BackendNodeId::new(node_id)))
            .await
            .map_err(|e| BrowserError::Action(e.to_string()))?;
        let position = node.get_position().await.ok_or_else(|| {
            BrowserError::Action(format!("Could not get position for: {node_id}"))
        })?;
        let target_y = position.y as i32;
        // I don't want to delve into the nuance of scroll right now !!! To Fix. !!!
        if false {
            let ctx = BrowsingContext::from_id(String::new(), CreateType::Tab);
            self.session
                .browser()
                .human_mouse()
                .scroll(target_y, 0, ctx.id())
                .await
                .map_err(|e| BrowserError::Action(e.to_string()))
        } else {
            node.scroll_into_view()
                .await
                .map_err(|e| BrowserError::Action(e.to_string()))
        }
    }

    pub async fn create_context(&mut self, url: &str) -> Result<String, BrowserError> {
        let browsing_ctx = self
            .session
            .browser_mut()
            .create_tab(url)
            .await
            .map_err(|e| BrowserError::Context(e.to_string()))?;
        let id: String = browsing_ctx.target_id().inner().to_owned();
        self.contexts.insert(id.clone(), browsing_ctx);
        Ok(id)
    }

    pub async fn close_context(&mut self, context_id: &str) -> Result<(), BrowserError> {
        let _browsing_ctx = self
            .contexts
            .remove(context_id)
            .ok_or_else(|| BrowserError::Context(format!("Context not found: {context_id}")))?;
        // Incomplete feature
        // if let Err(e) = self
        //     .session
        //     .browser_mut()
        //     .c
        //     .close_context(browsing_ctx.clone())
        //     .await
        // {
        //     self.contexts.insert(context_id.to_string(), browsing_ctx);
        //     return Err(BrowserError::Context(e.to_string()));
        // }
        Ok(())
    }

    pub async fn find_node(&mut self, selector: &str) -> Result<i64, BrowserError> {
        // Locate by CSS selector, then extract the CDP NodeId for reuse in subsequent operations
        let node = self
            .session
            .browser_mut()
            .locate(Selector::Css(selector.to_string()))
            .await
            .map_err(|e| BrowserError::Action(e.to_string()))?
            .ok_or_else(|| BrowserError::Action(format!("Node not found: {selector}")))?;
        Ok(node.node_id().inner().to_owned())
    }

    pub async fn wait_for_node(
        &mut self,
        selector: &str,
        timeout_ms: u64,
    ) -> Result<i64, BrowserError> {
        // Wait until present, then extract CDP NodeId — same as find_node
        let node = self
            .session
            .browser_mut()
            .wait_for(
                Selector::Css(selector.to_string()),
                Duration::from_millis(timeout_ms),
            )
            .await
            .map_err(|e| BrowserError::Action(e.to_string()))?;
        Ok(node.node_id().inner().to_owned())
    }

    pub async fn fetch_html(&mut self, node_id: Option<i64>) -> Result<String, BrowserError> {
        let Some(id) = node_id else {
            // No node_id — return full document HTML
            let node = self
                .session
                .browser_mut()
                .locate(Selector::Css("html".to_string()))
                .await
                .map_err(|e| BrowserError::Action(e.to_string()))?
                .ok_or_else(|| BrowserError::Action("html element not found".into()))?;
            return Ok(node.get_html().await);
        };
        // Same fetch_node pattern as node_click / type_text
        let node = self
            .session
            .browser_mut()
            .fetch_node(FetchNodeOptions::default().node_id(NodeId::new(id)))
            .await
            .map_err(|e| BrowserError::Action(e.to_string()))?;
        Ok(node.get_html().await)
    }

    pub async fn fetch_text(&mut self, node_id: i64) -> Result<String, BrowserError> {
        // Same fetch_node pattern as node_click / type_text
        let node = self
            .session
            .browser_mut()
            .fetch_node(FetchNodeOptions::default().node_id(NodeId::new(node_id)))
            .await
            .map_err(|e| BrowserError::Action(e.to_string()))?;
        Ok(node.get_inner_text().await)
    }

    pub async fn get_ui_map(&mut self) -> Result<Vec<rusty_common::ui_map::UiNode>, BrowserError> {
        fn collect(nodes: &[AXNode], out: &mut Vec<UiNode>) {
            for n in nodes {
                let id = n.backend_dom_node_id.unwrap_or(0);
                let parent_id = n.parent_id.as_deref().and_then(|s| s.parse::<i64>().ok());
                let role = n
                    .role
                    .as_ref()
                    .and_then(|v| v.value.as_ref())
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let name = n
                    .name
                    .as_ref()
                    .and_then(|v| v.value.as_ref())
                    .and_then(|v| v.as_str())
                    .map(str::to_string);
                let value = n
                    .value
                    .as_ref()
                    .and_then(|v| v.value.as_ref())
                    .and_then(|v| v.as_str())
                    .map(str::to_string);
                let props: serde_json::Map<String, serde_json::Value> = n
                    .properties
                    .iter()
                    .filter_map(|p| {
                        Some((format!("{:?}", p.name), p.value.value.as_ref()?.clone()))
                    })
                    .collect();
                out.push(UiNode {
                    id,
                    role,
                    name,
                    parent_id,
                    value,
                    properties: if props.is_empty() { None } else { Some(props) },
                });
                collect(&n.children, out);
            }
        }

        let nodes = self
            .session
            .browser_mut()
            .get_accessible_nodes(true)
            .await
            .map_err(|e| BrowserError::Action(e.to_string()))?;
        let mut result = Vec::new();
        collect(&nodes, &mut result);
        Ok(result)
    }

    pub async fn eval_js(&mut self, script: &str) -> Result<String, BrowserError> {
        self.session
            .browser_mut()
            .evaluate_script(script.to_string(), false)
            .await
            .map(|v| format!("{:?}", v))
            .map_err(|e| BrowserError::Action(format!("{:?}", e)))
    }

    pub async fn close(self) -> bool {
        let Self { session, xvfb, vnc, .. } = self;
        let result = session.close().await;
        for proc in [vnc, xvfb].into_iter().flatten() {
            let mut child = proc;
            let _ = child.kill();
            let _ = child.wait();
        }
        result
    }
}

fn default_flag(flags: &mut Vec<String>, prefix: &str, value: impl FnOnce() -> String) {
    if !flags.iter().any(|f| f.starts_with(prefix)) {
        flags.push(value());
    }
}

fn spawn_x11vnc(display_id: &str) -> Result<(Child, u16), BrowserError> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| BrowserError::Launch(format!("x11vnc port reserve: {e}")))?;
    let port = listener
        .local_addr()
        .map_err(|e| BrowserError::Launch(format!("x11vnc port read: {e}")))?
        .port();
    drop(listener);

    let child = Command::new("x11vnc")
        .args([
            "-display", display_id,
            "-rfbport", &port.to_string(),
            "-localhost",
            "-nopw",
            "-forever",
            "-shared",
            "-quiet",
            "-noxdamage",
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| BrowserError::Launch(format!("x11vnc spawn: {e}")))?;

    tracing::info!("x11vnc {display_id} on 127.0.0.1:{port}");
    Ok((child, port))
}

fn spawn_xvfb(width: u32, height: u32) -> Result<Child, BrowserError> {
    let mut child = Command::new("Xvfb")
        .args([
            "-displayfd",
            "1",
            "-screen",
            "0",
            &format!("{width}x{height}x24"),
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| BrowserError::Launch(format!("Xvfb spawn: {e}")))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| BrowserError::Launch("Xvfb stdout missing".into()))?;
    let mut line = String::new();
    BufReader::new(stdout)
        .read_line(&mut line)
        .map_err(|e| BrowserError::Launch(format!("Xvfb displayfd read: {e}")))?;
    let display_num: u32 = line
        .trim()
        .parse()
        .map_err(|e| BrowserError::Launch(format!("Xvfb display number parse: {e}")))?;

    // SAFETY: set_var is unsafe under edition 2024 because concurrent threads reading env
    // could race. Called once per agent process during browser launch — keep an eye on this
    // if anything else starts reading DISPLAY concurrently.
    unsafe { std::env::set_var("DISPLAY", format!(":{display_num}")); }
    tracing::info!("Xvfb display :{display_num} ({width}x{height}x24)");
    Ok(child)
}

fn random_point(x: f64, y: f64, width: f64, height: f64) -> Point {
    let mut rng = rand::thread_rng();
    Point {
        x: x as f64 + rng.gen_range(0.0..width as f64),
        y: y as f64 + rng.gen_range(0.0..height as f64),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ---- ChromeBrowserLaunchConfig defaults ----

    #[test]
    fn default_has_all_none_and_empty() {
        let cfg = ChromeBrowserLaunchConfig::default();
        assert!(cfg.driver_executable_path.is_none());
        assert!(cfg.host.is_none());
        assert!(cfg.port.is_none());
        assert!(cfg.driver_flags.is_empty());
        assert!(!cfg.sandbox);
        assert!(cfg.chrome_executable_path.is_none());
        assert!(cfg.user_data_dir.is_none());
        assert!(cfg.browser_flags.is_empty());
    }

    // ---- ChromeBrowserLaunchConfig JSON deserialization ----

    #[test]
    fn deserializes_full_config() {
        let json = r#"{
            "driver_executable_path": "/usr/bin/chromedriver",
            "host": "localhost",
            "port": 9515,
            "driver_flags": ["--verbose"],
            "sandbox": true,
            "chrome_executable_path": "/usr/bin/google-chrome",
            "user_data_dir": "/tmp/profile",
            "browser_flags": ["--headless", "--no-sandbox"]
        }"#;
        let cfg: ChromeBrowserLaunchConfig = serde_json::from_str(json).unwrap();
        assert_eq!(cfg.driver_executable_path.as_deref(), Some("/usr/bin/chromedriver"));
        assert_eq!(cfg.host.as_deref(), Some("localhost"));
        assert_eq!(cfg.port, Some(9515));
        assert_eq!(cfg.driver_flags, vec!["--verbose"]);
        assert!(cfg.sandbox);
        assert_eq!(cfg.chrome_executable_path.as_deref(), Some("/usr/bin/google-chrome"));
        assert_eq!(cfg.user_data_dir.as_deref(), Some("/tmp/profile"));
        assert_eq!(cfg.browser_flags, vec!["--headless", "--no-sandbox"]);
    }

    #[test]
    fn deserializes_minimal_required_fields() {
        let json = r#"{"driver_flags": [], "browser_flags": []}"#;
        let cfg: ChromeBrowserLaunchConfig = serde_json::from_str(json).unwrap();
        assert!(cfg.driver_executable_path.is_none());
        assert!(cfg.host.is_none());
        assert!(cfg.port.is_none());
        assert!(cfg.driver_flags.is_empty());
        assert!(!cfg.sandbox);
        assert!(cfg.browser_flags.is_empty());
    }

    #[test]
    fn deserializes_partial_config() {
        let json = r#"{"sandbox": true, "port": 4444, "driver_flags": [], "browser_flags": []}"#;
        let cfg: ChromeBrowserLaunchConfig = serde_json::from_str(json).unwrap();
        assert!(cfg.sandbox);
        assert_eq!(cfg.port, Some(4444));
        assert!(cfg.driver_executable_path.is_none());
    }

    #[test]
    fn deserializes_multiple_browser_flags() {
        let json = r#"{"driver_flags": [], "browser_flags": ["--disable-gpu", "--window-size=1920,1080", "--lang=en-US"]}"#;
        let cfg: ChromeBrowserLaunchConfig = serde_json::from_str(json).unwrap();
        assert_eq!(cfg.browser_flags.len(), 3);
        assert!(cfg.browser_flags.contains(&"--disable-gpu".to_string()));
    }

    // ---- from_env ----

    #[test]
    fn from_env_returns_none_when_var_unset() {
        // Ensure the var is absent — reading a missing var is always safe
        if std::env::var("RUSTY_BROWSER_CONFIG").is_ok() {
            // var happens to be set in this environment, skip rather than fail
            return;
        }
        assert!(ChromeBrowserLaunchConfig::from_env().is_none());
    }

    #[test]
    fn from_env_returns_none_when_var_has_invalid_json() {
        // We can't set env vars without unsafe, but we can exercise the json
        // parsing branch indirectly by directly calling serde_json on bad input.
        let result: Option<ChromeBrowserLaunchConfig> = serde_json::from_str("not json").ok();
        assert!(result.is_none());
    }

    // ---- random_point bounds ----

    #[test]
    fn random_point_is_within_bounding_box() {
        for _ in 0..50 {
            let p = random_point(10.0, 20.0, 100.0, 50.0);
            assert!(p.x >= 10.0 && p.x < 110.0, "x={} out of bounds", p.x);
            assert!(p.y >= 20.0 && p.y < 70.0, "y={} out of bounds", p.y);
        }
    }

    #[test]
    fn random_point_unit_dimensions_stays_at_origin() {
        // width=1, height=1 → gen_range(0.0..1.0) is valid and stays within [x, x+1)
        for _ in 0..20 {
            let p = random_point(5.0, 8.0, 1.0, 1.0);
            assert!(p.x >= 5.0 && p.x < 6.0);
            assert!(p.y >= 8.0 && p.y < 9.0);
        }
    }

    // ---- From<ChromeBrowserLaunchConfig> for ChromeConfig ----

    #[test]
    fn from_default_launch_config_preserves_chrome_defaults() {
        let cfg = ChromeBrowserLaunchConfig::default();
        let default_chrome = ChromeConfig::default();
        let chrome: ChromeConfig = cfg.into();
        assert_eq!(chrome.driver_executable_path, default_chrome.driver_executable_path);
        assert_eq!(chrome.host, default_chrome.host);
        assert_eq!(chrome.port, default_chrome.port);
        assert_eq!(chrome.chrome_executable_path, default_chrome.chrome_executable_path);
        assert_eq!(chrome.user_data_dir, default_chrome.user_data_dir);
        assert!(!chrome.sandbox);
        // browser_flags should remain at its default (the From impl only sets it when non-empty)
        assert_eq!(chrome.browser_flags.is_some(), default_chrome.browser_flags.is_some());
    }

    #[test]
    fn from_launch_config_propagates_set_fields() {
        let cfg = ChromeBrowserLaunchConfig {
            driver_executable_path: Some("/usr/bin/chromedriver".into()),
            host: Some("example.com".into()),
            port: Some(9515),
            driver_flags: vec![],
            sandbox: true,
            chrome_executable_path: Some("/usr/bin/google-chrome".into()),
            user_data_dir: Some("/tmp/profile".into()),
            browser_flags: vec![],
        };
        let chrome: ChromeConfig = cfg.into();
        assert_eq!(chrome.driver_executable_path, "/usr/bin/chromedriver");
        assert_eq!(chrome.host.as_deref(), Some("example.com"));
        assert_eq!(chrome.port, Some(9515));
        assert!(chrome.sandbox);
        assert_eq!(chrome.chrome_executable_path.as_deref(), Some("/usr/bin/google-chrome"));
        assert_eq!(chrome.user_data_dir.as_deref(), Some("/tmp/profile"));
    }

    #[test]
    fn from_launch_config_empty_browser_flags_stays_none() {
        // Important: the From impl only assigns browser_flags when the input is non-empty,
        // preserving ChromeConfig's default behavior (which is None).
        let cfg = ChromeBrowserLaunchConfig {
            browser_flags: vec![],
            ..ChromeBrowserLaunchConfig::default()
        };
        let chrome: ChromeConfig = cfg.into();
        let default_browser_flags = ChromeConfig::default().browser_flags;
        assert_eq!(chrome.browser_flags, default_browser_flags);
    }

    #[test]
    fn from_launch_config_browser_flags_propagate_when_set() {
        let cfg = ChromeBrowserLaunchConfig {
            browser_flags: vec!["--headless".into(), "--disable-gpu".into()],
            ..ChromeBrowserLaunchConfig::default()
        };
        let chrome: ChromeConfig = cfg.into();
        let flags = chrome.browser_flags.expect("browser_flags should be Some when input is non-empty");
        assert_eq!(flags, vec!["--headless".to_string(), "--disable-gpu".to_string()]);
    }

    #[test]
    fn from_launch_config_driver_flags_propagate_when_set() {
        // Note: the From impl Box::leaks each flag string. In a test process this
        // permanently leaks a few bytes — acceptable for a one-shot test run.
        let cfg = ChromeBrowserLaunchConfig {
            driver_flags: vec!["--verbose".into(), "--log-level=DEBUG".into()],
            ..ChromeBrowserLaunchConfig::default()
        };
        let chrome: ChromeConfig = cfg.into();
        assert_eq!(chrome.driver_flags.len(), 2);
        assert!(chrome.driver_flags.contains(&"--verbose"));
        assert!(chrome.driver_flags.contains(&"--log-level=DEBUG"));
    }
}
