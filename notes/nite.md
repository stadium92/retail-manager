export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20
cd Pro/retail-manager/backend/local-bridge
rm -rf node_modules pnpm-lock.yaml
npm install -g node-gyp
pnpm install --config.arch=arm64 --config.platform=darwin
pnpm rebuild better-sqlite3
pnpm dev