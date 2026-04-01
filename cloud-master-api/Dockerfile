# 1. Build stage
FROM rust:1.75-slim-bookworm as builder

WORKDIR /app

# Install system dependencies for SQLx and other crates
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy manifests
COPY Cargo.toml ./

# Create dummy source to pre-build dependencies (caching)
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -f target/release/deps/cloud_master_api*

# Copy actual source code
COPY src ./src

# Build for release
RUN cargo build --release

# 2. Runtime stage
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies (OpenSSL)
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy the binary from the builder stage
COPY --from=builder /app/target/release/cloud-master-api .

# Expose port
EXPOSE 3000

# Run the binary
CMD ["./cloud-master-api"]
