import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../convex/_generated/api.js";

const API_KEY_STORAGE_KEY = "convex-jina-api-key";

function ApiKeyInput({
	apiKey,
	onApiKeyChange,
}: {
	apiKey: string;
	onApiKeyChange: (key: string) => void;
}) {
	const [visible, setVisible] = useState(false);

	const handleClear = () => {
		onApiKeyChange("");
		localStorage.removeItem(API_KEY_STORAGE_KEY);
	};

	const handleChange = (value: string) => {
		onApiKeyChange(value);
		if (value) {
			localStorage.setItem(API_KEY_STORAGE_KEY, value);
		} else {
			localStorage.removeItem(API_KEY_STORAGE_KEY);
		}
	};

	return (
		<section className="bg-white rounded-lg shadow p-6">
			<h2 className="text-xl font-semibold mb-2">API Key</h2>
			<p className="text-gray-600 mb-3 text-sm">
				Enter your Jina AI API key to use the demo.{" "}
				<a
					href="https://jina.ai/api"
					target="_blank"
					rel="noopener noreferrer"
					className="text-blue-600 hover:underline"
				>
					Get your free API key
				</a>{" "}
				(1M tokens/month free).
			</p>

			<div className="flex gap-2 mb-2">
				<div className="relative flex-1">
					<input
						type={visible ? "text" : "password"}
						value={apiKey}
						onChange={(e) => handleChange(e.target.value)}
						placeholder="jina_..."
						className="w-full border rounded px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
					<button
						type="button"
						onClick={() => setVisible(!visible)}
						className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
					>
						{visible ? "Hide" : "Show"}
					</button>
				</div>
				{apiKey && (
					<button
						type="button"
						onClick={handleClear}
						className="border border-gray-300 text-gray-600 px-3 py-2 rounded text-sm hover:bg-gray-50"
					>
						Clear
					</button>
				)}
			</div>

			<p className="text-xs text-gray-400">
				Your API key is stored locally in your browser and never saved on our servers.
			</p>
		</section>
	);
}

function ReaderDemo({ apiKey }: { apiKey: string }) {
	const [url, setUrl] = useState("");
	const [cacheId, setCacheId] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const readUrl = useAction(api.jina.readUrl);
	const content = useQuery(api.jina.getReaderContent, cacheId ? { cacheId } : "skip");

	const handleRead = async () => {
		if (!url.trim() || !apiKey) return;
		setLoading(true);
		setError(null);
		try {
			const result = await readUrl({ url: url.trim(), apiKey });
			setCacheId(result.cacheId);
			if (result.status === "failed") {
				setError("Failed to read URL. Check the Convex dashboard for details.");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setLoading(false);
		}
	};

	const disabled = !apiKey;

	return (
		<section className="bg-white rounded-lg shadow p-6">
			<h2 className="text-xl font-semibold mb-4">URL Reader</h2>
			<p className="text-gray-600 mb-4 text-sm">
				Convert any URL to clean, LLM-friendly markdown using Jina Reader API.
			</p>

			<div className="flex gap-2 mb-4">
				<input
					type="url"
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					placeholder="https://example.com"
					disabled={disabled}
					className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-50"
					onKeyDown={(e) => e.key === "Enter" && handleRead()}
				/>
				<button
					type="button"
					onClick={handleRead}
					disabled={loading || !url.trim() || disabled}
					className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{loading ? "Reading..." : "Read"}
				</button>
			</div>

			{disabled && (
				<p className="text-xs text-gray-400 mb-4">Enter your API key above to enable.</p>
			)}

			{error && (
				<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-4">
					{error}
				</div>
			)}

			{content && (
				<div className="border rounded">
					<div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
						<div>
							<span className="font-medium text-sm">{content.title || "Untitled"}</span>
							{content.status === "completed" && (
								<span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
									{content.tokensUsed.toLocaleString()} tokens
								</span>
							)}
						</div>
						<span
							className={`text-xs px-2 py-0.5 rounded ${
								content.status === "completed"
									? "bg-green-100 text-green-700"
									: content.status === "pending"
										? "bg-yellow-100 text-yellow-700"
										: "bg-red-100 text-red-700"
							}`}
						>
							{content.status}
						</span>
					</div>
					{content.status === "pending" && (
						<div className="p-4 text-center text-gray-500 text-sm">Reading URL...</div>
					)}
					{content.status === "failed" && content.error && (
						<div className="p-4 text-red-600 text-sm">{content.error}</div>
					)}
					{content.status === "completed" && (
						<pre className="p-4 text-xs overflow-auto max-h-96 whitespace-pre-wrap">
							{content.content}
						</pre>
					)}
				</div>
			)}
		</section>
	);
}

function SearchDemo({ apiKey }: { apiKey: string }) {
	const [query, setQuery] = useState("");
	const [cacheId, setCacheId] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const searchWeb = useAction(api.jina.searchWeb);
	const results = useQuery(api.jina.getSearchResults, cacheId ? { cacheId } : "skip");

	const handleSearch = async () => {
		if (!query.trim() || !apiKey) return;
		setLoading(true);
		setError(null);
		try {
			const result = await searchWeb({ query: query.trim(), apiKey });
			setCacheId(result.cacheId);
			if (result.status === "failed") {
				setError("Search failed. Check the Convex dashboard for details.");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setLoading(false);
		}
	};

	const disabled = !apiKey;

	return (
		<section className="bg-white rounded-lg shadow p-6">
			<h2 className="text-xl font-semibold mb-4">Web Search</h2>
			<p className="text-gray-600 mb-4 text-sm">
				Search the web and get structured, LLM-friendly results via Jina Search API.
			</p>

			<div className="flex gap-2 mb-4">
				<input
					type="text"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search the web..."
					disabled={disabled}
					className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-50"
					onKeyDown={(e) => e.key === "Enter" && handleSearch()}
				/>
				<button
					type="button"
					onClick={handleSearch}
					disabled={loading || !query.trim() || disabled}
					className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{loading ? "Searching..." : "Search"}
				</button>
			</div>

			{disabled && (
				<p className="text-xs text-gray-400 mb-4">Enter your API key above to enable.</p>
			)}

			{error && (
				<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm mb-4">
					{error}
				</div>
			)}

			{results && (
				<div>
					<div className="flex items-center justify-between mb-3">
						<span className="text-sm text-gray-500">{results.results.length} results</span>
						{results.status === "completed" && (
							<span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
								{results.totalTokensUsed.toLocaleString()} tokens
							</span>
						)}
					</div>

					{results.status === "pending" && (
						<div className="text-center text-gray-500 text-sm py-8">Searching...</div>
					)}

					{results.status === "completed" && (
						<div className="space-y-3">
							{results.results.map((result: any, i: number) => (
								<div key={result.url || i} className="border rounded p-3">
									<a
										href={result.url}
										target="_blank"
										rel="noopener noreferrer"
										className="text-blue-600 hover:underline font-medium text-sm"
									>
										{result.title || result.url}
									</a>
									<p className="text-gray-600 text-xs mt-1">{result.description}</p>
									{result.content && (
										<pre className="text-xs text-gray-500 mt-2 max-h-32 overflow-auto whitespace-pre-wrap">
											{result.content.slice(0, 500)}
											{result.content.length > 500 ? "..." : ""}
										</pre>
									)}
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</section>
	);
}

function UsageDashboard() {
	const usage = useQuery(api.jina.getUsage, {});

	if (!usage) return null;

	return (
		<section className="bg-white rounded-lg shadow p-6">
			<h2 className="text-xl font-semibold mb-4">Usage</h2>
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<div className="text-center">
					<div className="text-2xl font-bold text-blue-600">
						{usage.totalTokens.toLocaleString()}
					</div>
					<div className="text-xs text-gray-500 mt-1">Total Tokens</div>
				</div>
				<div className="text-center">
					<div className="text-2xl font-bold text-green-600">
						{usage.readTokens.toLocaleString()}
					</div>
					<div className="text-xs text-gray-500 mt-1">Reader Tokens</div>
				</div>
				<div className="text-center">
					<div className="text-2xl font-bold text-purple-600">
						{usage.searchTokens.toLocaleString()}
					</div>
					<div className="text-xs text-gray-500 mt-1">Search Tokens</div>
				</div>
				<div className="text-center">
					<div className="text-2xl font-bold text-orange-600">{usage.operationCount}</div>
					<div className="text-xs text-gray-500 mt-1">Operations</div>
				</div>
			</div>
		</section>
	);
}

export default function App() {
	const [apiKey, setApiKey] = useState(() => {
		return localStorage.getItem(API_KEY_STORAGE_KEY) ?? "";
	});

	return (
		<div className="min-h-screen py-8">
			<div className="max-w-3xl mx-auto px-4">
				<header className="mb-8">
					<h1 className="text-3xl font-bold">Convex Jina AI</h1>
					<p className="text-gray-600 mt-1">
						Read any URL as clean markdown and search the web - with durable caching and reactive
						queries.
					</p>
				</header>

				<div className="space-y-6">
					<ApiKeyInput apiKey={apiKey} onApiKeyChange={setApiKey} />
					<UsageDashboard />
					<ReaderDemo apiKey={apiKey} />
					<SearchDemo apiKey={apiKey} />
				</div>

				<footer className="mt-12 text-center text-xs text-gray-400">
					Powered by{" "}
					<a href="https://jina.ai" className="underline" target="_blank" rel="noopener noreferrer">
						Jina AI
					</a>{" "}
					+{" "}
					<a
						href="https://convex.dev"
						className="underline"
						target="_blank"
						rel="noopener noreferrer"
					>
						Convex
					</a>
				</footer>
			</div>
		</div>
	);
}
