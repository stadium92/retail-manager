use axum::{
    routing::{get, post},
    Json, Router, extract::{State, HeaderMap},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use sqlx::{postgres::PgPoolOptions, Pool, Postgres};
use std::net::SocketAddr;
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Clone)]
struct AppState {
    db: Pool<Postgres>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SyncPayload {
    store_id: Uuid,
    sync_token: String,
    sales: Vec<SaleData>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SaleData {
    id: Uuid,
    worker_name: Option<String>,
    total_price: f64,
    payment_method: String,
    sale_type: String,
    items_json: serde_json::Value,
    created_at: DateTime<Utc>,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://admin:password123@localhost:5432/master_cloud".to_string());

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to Postgres");

    let state = AppState { db: pool };

    let app = Router::new()
        .route("/health", get(|| async { "OK" }))
        .route("/api/v1/sync", post(handle_sync))
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("🚀 Master Cloud API running on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn handle_sync(
    State(state): State<AppState>,
    Json(payload): Json<SyncPayload>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // 1. Verify Store and Token
    let store = sqlx::query!(
        "SELECT id, tenant_id FROM stores WHERE id = $1 AND sync_token = $2",
        payload.store_id,
        payload.sync_token
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let store = match store {
        Some(s) => s,
        None => return Err((StatusCode::UNAUTHORIZED, "Invalid store ID or sync token".into())),
    };

    // 2. Insert Sales (Idempotent using ON CONFLICT)
    for sale in payload.sales {
        sqlx::query!(
            r#"
            INSERT INTO sales (id, store_id, tenant_id, worker_name, total_price, payment_method, sale_type, items_json, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO NOTHING
            "#,
            sale.id,
            store.id,
            store.tenant_id,
            sale.worker_name,
            sale.total_price as f64,
            sale.payment_method,
            sale.sale_type,
            sale.items_json,
            sale.created_at
        )
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    Ok(Json(serde_json::json!({"status": "success"})))
}
