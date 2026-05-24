use std::sync::Arc;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::{extract::Path, extract::Query, extract::State, http::StatusCode, Json};
use futures::{SinkExt, StreamExt};
use rusty_common::display::DisplayMode;
use rusty_proto::DisplayChunk;
use serde::Deserialize;

use crate::http::error::AppError;
use crate::AppState;
use crate::services::browser_service::BrowserService;
use crate::services::instruct_service::AIInstructor;

fn svc(state: &Arc<AppState>) -> BrowserService {
    BrowserService::new(state.clone())
}

#[derive(Deserialize)]
pub struct CreateBrowserRequest {
    pub identity: Option<serde_json::Value>,
    #[serde(default)]
    pub display: DisplayMode,
}

pub async fn create_browser(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateBrowserRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    let execution_id = svc(&state).create_browser(req.identity, req.display).await?;
    Ok((StatusCode::ACCEPTED, Json(serde_json::json!({ "execution_id": execution_id }))))
}

pub async fn list_browsers(State(state): State<Arc<AppState>>) -> Result<Json<serde_json::Value>, AppError> {
    let browsers = svc(&state).list_browsers().await?;
    Ok(Json(serde_json::json!(browsers)))
}

pub async fn get_browser(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let browser = svc(&state).get_browser(&execution_id).await?;
    Ok(Json(serde_json::json!(browser)))
}

#[derive(Deserialize)]
pub struct ForceQuery {
    #[serde(default)]
    pub force: bool,
}

pub async fn delete_browser(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
    Query(q): Query<ForceQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    svc(&state).delete_browser(&execution_id, q.force).await?;
    Ok(Json(serde_json::json!({ "deleted": execution_id })))
}

pub async fn delete_all_browsers(
    State(state): State<Arc<AppState>>,
    Query(q): Query<ForceQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let log = svc(&state).delete_all_browsers(q.force).await?;
    Ok(Json(serde_json::json!({ "deleted": log })))
}


pub async fn stream_display(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
    headers: axum::http::HeaderMap,
    ws: WebSocketUpgrade,
) -> Result<axum::response::Response, AppError> {
    let (agent_tx, agent_rx) = svc(&state).stream_display(&execution_id).await?;
    // Echo back the requested subprotocol so the browser accepts the upgrade. The api-key
    // middleware has already validated this value as a known key.
    let upgrade = match headers
        .get("sec-websocket-protocol")
        .and_then(|v| v.to_str().ok())
    {
        Some(proto) => ws.protocols([proto.to_string()]),
        None => ws,
    };
    Ok(upgrade.on_upgrade(move |socket| pipe_display(socket, agent_tx, agent_rx)))
}

async fn pipe_display(
    socket: WebSocket,
    agent_tx: tokio::sync::mpsc::Sender<DisplayChunk>,
    mut agent_rx: tonic::Streaming<DisplayChunk>,
) {
    let (mut ws_sink, mut ws_stream) = socket.split();

    let to_agent = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_stream.next().await {
            let bytes = match msg {
                Message::Binary(b) => b.to_vec(),
                Message::Close(_) => break,
                _ => continue,
            };
            if agent_tx.send(DisplayChunk { data: bytes }).await.is_err() {
                break;
            }
        }
    });

    let to_client = tokio::spawn(async move {
        while let Ok(Some(chunk)) = agent_rx.message().await {
            if ws_sink.send(Message::Binary(chunk.data.into())).await.is_err() {
                break;
            }
        }
    });

    let _ = tokio::join!(to_agent, to_client);
}

pub async fn create_context(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    let context_id = svc(&state).create_context(&execution_id).await?;
    Ok((StatusCode::CREATED, Json(serde_json::json!({ "execution_id": execution_id, "context_id": context_id }))))
}

pub async fn delete_context(
    State(state): State<Arc<AppState>>,
    Path((execution_id, ctx_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, AppError> {
    svc(&state).delete_context(&execution_id, &ctx_id).await?;
    Ok(Json(serde_json::json!({ "deleted_context": ctx_id, "execution_id": execution_id })))
}

#[derive(Deserialize)]
pub struct NavigateRequest {
    pub url: String,
    pub wait_until: Option<String>,
}

pub async fn navigate(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
    Json(req): Json<NavigateRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    svc(&state).navigate(&execution_id, req.url, req.wait_until).await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

#[derive(Deserialize)]
pub struct ClickRequest {
    pub x: f32,
    pub y: f32,
    pub human: Option<bool>,
}

pub async fn click(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
    Json(req): Json<ClickRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    svc(&state).click(&execution_id, req.x, req.y, req.human.unwrap_or(true)).await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

#[derive(Deserialize)]
pub struct TypeRequest {
    pub text: String,
    pub node_id: Option<i64>,
}

pub async fn type_text(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
    Json(req): Json<TypeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    svc(&state).type_text(&execution_id, req.text, req.node_id).await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn screenshot(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let data = svc(&state).screenshot(&execution_id).await?;
    Ok(Json(serde_json::json!({ "data": data })))
}

#[derive(Deserialize)]
pub struct EvalRequest {
    pub script: String,
}

pub async fn eval_js(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
    Json(req): Json<EvalRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = svc(&state).eval_js(&execution_id, req.script).await?;
    Ok(Json(serde_json::json!({ "result": result })))
}

#[derive(Deserialize)]
pub struct ScrollByRequest {
    pub y: i32,
    pub human: Option<bool>,
}

pub async fn scroll_by(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
    Json(req): Json<ScrollByRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    svc(&state).scroll_by(&execution_id, req.y, req.human.unwrap_or(false)).await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

#[derive(Deserialize)]
pub struct ScrollToRequest {
    pub node_id: i64,
    pub human: Option<bool>,
}

pub async fn scroll_to(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
    Json(req): Json<ScrollToRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    svc(&state).scroll_to(&execution_id, req.node_id, req.human.unwrap_or(false)).await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

#[derive(Deserialize)]
pub struct SendKeysRequest {
    pub keys: String,
}

pub async fn send_keys(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
    Json(req): Json<SendKeysRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    svc(&state).send_keys(&execution_id, &req.keys).await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

#[derive(Deserialize)]
pub struct HoldKeyRequest {
    pub key: String,
}

pub async fn hold_key(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
    Json(req): Json<HoldKeyRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    svc(&state).hold_key(&execution_id, &req.key).await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

#[derive(Deserialize)]
pub struct InstructRequest {
    pub instruction: String,
}

pub async fn instruct(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
    Json(req): Json<InstructRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    {
        let mut locks = state.instruct_locks.lock().unwrap();
        if !locks.insert(execution_id.clone()) {
            return Err(AppError::Conflict("an instruction is already running for this browser".to_string()));
        }
    }
    let svc = svc(&state);
    if let Err(e) = svc.get_browser(&execution_id).await {
        state.instruct_locks.lock().unwrap().remove(&execution_id);
        return Err(e);
    }
    let id = execution_id.clone();
    tokio::spawn(async move {
        if let Err(e) = svc.instruct(&id, &req.instruction).await {
            tracing::error!("instruct {id} failed: {e}");
        }
        state.instruct_locks.lock().unwrap().remove(&id);
    });
    Ok((StatusCode::ACCEPTED, Json(serde_json::json!({ "execution_id": execution_id, "status": "running" }))))
}

#[derive(Deserialize)]
pub struct NodeClickRequest {
    pub node_id: i64,
    pub human: Option<bool>,
}

pub async fn node_click(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
    Json(req): Json<NodeClickRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    svc(&state).node_click(&execution_id, req.node_id, req.human.unwrap_or(true)).await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

#[derive(Deserialize)]
pub struct FetchHtmlRequest {
    pub node_id: Option<i64>,
}

pub async fn fetch_html(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
    Json(req): Json<FetchHtmlRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let html = svc(&state).fetch_html(&execution_id, req.node_id).await?;
    Ok(Json(serde_json::json!({ "html": html })))
}

#[derive(Deserialize)]
pub struct FetchTextRequest {
    pub node_id: i64,
}

pub async fn fetch_text(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
    Json(req): Json<FetchTextRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let text = svc(&state).fetch_text(&execution_id, req.node_id).await?;
    Ok(Json(serde_json::json!({ "text": text })))
}

#[derive(Deserialize)]
pub struct FindNodeRequest {
    pub selector: String,
}

pub async fn find_node(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
    Json(req): Json<FindNodeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let node_id = svc(&state).find_node(&execution_id, req.selector).await?;
    Ok(Json(serde_json::json!({ "node_id": node_id })))
}

#[derive(Deserialize)]
pub struct WaitForNodeRequest {
    pub selector: String,
    pub timeout_ms: u64,
}

pub async fn wait_for_node(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
    Json(req): Json<WaitForNodeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let node_id = svc(&state).wait_for_node(&execution_id, req.selector, req.timeout_ms).await?;
    Ok(Json(serde_json::json!({ "node_id": node_id })))
}

pub async fn get_ui_map(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let nodes = svc(&state).get_ui_map(&execution_id).await?;
    Ok(Json(serde_json::json!(nodes)))
}

pub async fn get_ui_map_diff(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let diff = svc(&state).get_ui_map_diff(&execution_id).await?;
    Ok(Json(serde_json::json!(diff)))
}

pub async fn teardown(
    State(state): State<Arc<AppState>>,
    Query(q): Query<ForceQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = svc(&state).teardown(q.force).await?;
    Ok(Json(result))
}

pub async fn get_execution_logs(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let logs = svc(&state).get_execution_logs(&execution_id).await?;
    Ok(Json(serde_json::json!({ "logs": logs })))
}
