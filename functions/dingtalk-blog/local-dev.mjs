import http from 'node:http';

import { handleRequest } from './index.mjs';

const port = Number(process.env.PORT || 9000);

const server = http.createServer(async (req, res) => {
	const chunks = [];

	for await (const chunk of req) {
		chunks.push(chunk);
	}

	const body = chunks.length > 0 ? Buffer.concat(chunks).toString('utf8') : '';
	const result = await handleRequest({
		method: req.method,
		path: req.url || '/',
		headers: req.headers,
		body,
	});

	res.writeHead(result.statusCode, result.headers);
	res.end(result.body);
});

server.listen(port, () => {
	console.log(`dingtalk-blog local server listening on http://127.0.0.1:${port}`);
});
