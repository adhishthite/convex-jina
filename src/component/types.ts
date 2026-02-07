/**
 * Jina AI API response and configuration types.
 */

// Reader types
export interface ReaderOptions {
	/** Target URL to fetch content from */
	url: string;
	/** Return JSON instead of markdown (default: false) */
	json?: boolean;
	/** Include links in the output (default: true) */
	includeLinks?: boolean;
	/** Include images in the output (default: true) */
	includeImages?: boolean;
	/** Target selector to extract specific content */
	targetSelector?: string;
	/** Wait for specific selector before extraction */
	waitForSelector?: string;
	/** Timeout in milliseconds (default: 30000) */
	timeout?: number;
	/** Custom headers to send with the request */
	headers?: Record<string, string>;
}

export interface ReaderJsonResponse {
	code: number;
	status: number;
	data: {
		title: string;
		description: string;
		url: string;
		content: string;
		links?: Record<string, string>;
		images?: Record<string, string>;
		usage?: {
			tokens: number;
		};
	};
}

export interface ReaderResult {
	/** Extracted content (markdown or structured) */
	content: string;
	/** Page title */
	title: string;
	/** Page description/meta */
	description: string;
	/** Final URL after redirects */
	url: string;
	/** Extracted links (if includeLinks=true and json=true) */
	links?: Record<string, string>;
	/** Extracted images (if includeImages=true and json=true) */
	images?: Record<string, string>;
	/** Token usage (if available) */
	tokens?: number;
}

// Search types
export interface SearchOptions {
	/** Search query */
	query: string;
	/** Return JSON instead of markdown (default: false) */
	json?: boolean;
	/** Number of results to return (default: 5, max: 10) */
	count?: number;
	/** Custom headers to send with the request */
	headers?: Record<string, string>;
}

export interface SearchJsonResponse {
	code: number;
	status: number;
	data: SearchResultItem[];
}

export interface SearchResultItem {
	title: string;
	description: string;
	url: string;
	content: string;
}

export interface SearchResult {
	/** Search results (structured if json=true, markdown string if json=false) */
	results: SearchResultItem[] | string;
	/** Number of results returned */
	count: number;
}

// Error types
export interface JinaError {
	code: string;
	message: string;
	statusCode?: number;
}

export class JinaApiError extends Error {
	readonly code: string;
	readonly statusCode?: number;

	constructor(message: string, code: string, statusCode?: number) {
		super(message);
		this.name = "JinaApiError";
		this.code = code;
		this.statusCode = statusCode;
	}
}
