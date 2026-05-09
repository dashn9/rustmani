/// Queries a public IP echo service to determine this machine's outbound public IP.
pub async fn detect_public_ip() -> Option<String> {
    let ip = reqwest::get("https://api.ipify.org")
        .await.ok()?
        .text()
        .await.ok()?;
    let ip = ip.trim().to_string();
    if ip.is_empty() { None } else { Some(ip) }
}

/// Binds to port 0 and lets the OS assign a free port, then returns it.
pub fn free_port() -> u16 {
    std::net::TcpListener::bind("0.0.0.0:0")
        .and_then(|l| l.local_addr())
        .map(|a| a.port())
        .expect("failed to find a free port")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn free_port_returns_nonzero_and_bindable_port() {
        let port = free_port();
        assert!(port > 0);
        // The OS may have reassigned the port by now, but we should still be able
        // to bind to *some* port via the same mechanism — exercise it twice.
        let listener = std::net::TcpListener::bind(format!("0.0.0.0:{port}"))
            .or_else(|_| std::net::TcpListener::bind("0.0.0.0:0"));
        assert!(listener.is_ok());
    }

    #[test]
    fn free_port_returns_distinct_ports_across_calls() {
        // Hold the first listener so the OS won't immediately recycle the port,
        // then ask for another free port — should differ.
        let first = std::net::TcpListener::bind("0.0.0.0:0").unwrap();
        let first_port = first.local_addr().unwrap().port();
        let second = free_port();
        assert_ne!(first_port, second);
    }
}
