import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 8080);
const maxPort = Number(process.env.PORT_MAX || port + 10);

const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml'
};

const server = createServer(async (req, res) => {
    try {
        const urlPath = decodeURIComponent(new URL(req.url || '/', `http://localhost:${port}`).pathname);
        const relativePath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
        const filePath = normalize(join(root, relativePath));

        if (!filePath.startsWith(root)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        const body = await readFile(filePath);
        res.writeHead(200, {
            'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream'
        });
        res.end(body);
    } catch {
        res.writeHead(404);
        res.end('Not found');
    }
});

function listen(currentPort) {
    server.listen(currentPort, () => {
        console.log(`Web app running at http://localhost:${currentPort}`);
    });
}

server.on('error', (error) => {
    const currentPort = server.address()?.port || port;
    if (error.code === 'EADDRINUSE' && currentPort < maxPort) {
        const nextPort = currentPort + 1;
        console.warn(`Port ${currentPort} is in use, trying ${nextPort}...`);
        server.close(() => listen(nextPort));
        return;
    }

    console.error(error.message);
    process.exitCode = 1;
});

listen(port);
