import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";
import { defineConfig } from "vite";
import { films } from "./src/page/films";

const siteRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(siteRoot, "..");

const served = films.flatMap((film) => [
	{ url: film.src, file: path.join(repoRoot, film.file), type: "video/mp4" },
	{ url: film.poster, file: path.join(repoRoot, film.posterFile), type: "image/jpeg" },
]);

function sendFile(
	req: IncomingMessage,
	res: ServerResponse,
	filePath: string,
	contentType: string,
) {
	if (!fs.existsSync(filePath)) {
		res.statusCode = 404;
		res.end("Not found");
		return;
	}
	const stat = fs.statSync(filePath);
	res.setHeader("Accept-Ranges", "bytes");
	res.setHeader("Content-Type", contentType);
	const range = req.headers.range;
	if (!range || !contentType.startsWith("video/")) {
		res.statusCode = 200;
		res.setHeader("Content-Length", stat.size);
		fs.createReadStream(filePath).pipe(res);
		return;
	}
	const match = /^bytes=(\d*)-(\d*)$/.exec(range);
	if (!match) {
		res.statusCode = 416;
		res.end();
		return;
	}
	const start = match[1] ? Number(match[1]) : 0;
	const end = match[2] ? Number(match[2]) : stat.size - 1;
	if (start > end || end >= stat.size) {
		res.statusCode = 416;
		res.setHeader("Content-Range", `bytes */${stat.size}`);
		res.end();
		return;
	}
	res.statusCode = 206;
	res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
	res.setHeader("Content-Length", end - start + 1);
	fs.createReadStream(filePath, { start, end }).pipe(res);
}

function videoFiles(): Plugin {
	const attach = (server: ViteDevServer | PreviewServer) => {
		server.middlewares.use((req, res, next) => {
			const url = req.url?.split("?")[0];
			const hit = served.find((item) => item.url === url);
			if (!hit) {
				next();
				return;
			}
			sendFile(req, res, hit.file, hit.type);
		});
	};

	return {
		name: "bumpy-videos",
		configureServer: attach,
		configurePreviewServer: attach,
		closeBundle() {
			const outDir = path.join(siteRoot, "dist", "videos");
			fs.mkdirSync(outDir, { recursive: true });
			for (const item of served) {
				if (!fs.existsSync(item.file)) continue;
				fs.copyFileSync(item.file, path.join(outDir, path.basename(item.url)));
			}
		},
	};
}

export default defineConfig({
	plugins: [react(), videoFiles()],
	define: {
		"import.meta.env.BUMPY_LOCAL_FILMS": JSON.stringify(
			films.filter((film) => fs.existsSync(path.join(repoRoot, film.file))).map((film) => film.id),
		),
	},
	server: {
		host: "127.0.0.1",
		port: 5173,
	},
	preview: {
		host: "127.0.0.1",
		port: 4173,
	},
});
