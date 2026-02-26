const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const PORT = 9100;
const JOBS_DIR = './dev-print-jobs';
const wss = new WebSocket.Server({ port: PORT });

// Create jobs directory if it doesn't exist
if (!fs.existsSync(JOBS_DIR)) {
    fs.mkdirSync(JOBS_DIR);
}

console.log(`🚀 Printer Agent Simulator running on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
    let clientToken = null;

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        console.log(`📩 Received: ${data.type}`);

        switch (data.type) {
            case 'register':
                clientToken = `tkn_${Math.random().toString(36).substr(2, 9)}`;
                ws.send(JSON.stringify({ 
                    type: 'register_ack', 
                    token: clientToken,
                    status: 'online'
                }));
                console.log(`✅ Client registered. Issued token: ${clientToken}`);
                break;

            case 'print':
                if (data.token !== clientToken) {
                    ws.send(JSON.stringify({ type: 'print_result', success: false, error: 'Unauthorized' }));
                    return;
                }

                console.log(`🖨️  Processing job ${data.jobId} for invoice ${data.payload.invoice}`);
                
                // Simulate "printing" by writing to a file
                const jobPath = path.join(JOBS_DIR, `${data.jobId}.txt`);
                const content = `
=========================================
        ${data.payload.storeName}
        ${data.payload.storeAddress}
        Tel: ${data.payload.phone}
=========================================
Invoice: ${data.payload.invoice}
Date: ${data.payload.date}
Cashier: ${data.payload.cashier}
-----------------------------------------
${data.payload.items.map(i => `${i.qty} x ${i.name.padEnd(20)} ${i.total} F`).join('\n')}
-----------------------------------------
Subtotal:  ${data.payload.subtotal} F
Discount:  ${data.payload.discount} F
TOTAL:     ${data.payload.total} F
=========================================
        THANK YOU FOR YOUR VISIT
=========================================
                `;

                fs.writeFileSync(jobPath, content);
                
                // Acknowledge receipt
                ws.send(JSON.stringify({ type: 'print_ack', jobId: data.jobId }));

                // Simulate hardware delay
                setTimeout(() => {
                    ws.send(JSON.stringify({ 
                        type: 'print_result', 
                        jobId: data.jobId, 
                        success: true 
                    }));
                    console.log(`✨ Job ${data.jobId} completed.`);
                }, 1000);
                break;

            case 'ping':
                ws.send(JSON.stringify({ type: 'pong' }));
                break;
        }
    });

    ws.on('close', () => console.log('❌ Client disconnected.'));
});
