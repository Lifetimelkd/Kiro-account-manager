declare module 'tlsclientwrapper' {
  export interface ModulePoolStats {
    totalWorkers?: number
    idleWorkers?: number
    busyWorkers?: number
    queueSize?: number
    [key: string]: unknown
  }

  export interface SessionOptions {
    tlsClientIdentifier?: string
    timeoutSeconds?: number
    followRedirects?: boolean
    insecureSkipVerify?: boolean
    proxyUrl?: string
    [key: string]: unknown
  }

  export interface RequestOptions {
    headers?: Record<string, string>
    body?: string
    cookies?: Array<{ name: string; value: string; domain?: string; path?: string }>
    timeoutSeconds?: number
    insecureSkipVerify?: boolean
    followRedirects?: boolean
    isByteResponse?: boolean
    [key: string]: unknown
  }

  export interface ResponseLike {
    status: number
    body?: string
    headers?: Record<string, string | string[]>
    cookies?: Array<{ name: string; value: string; domain?: string; path?: string }>
    target?: string
    [key: string]: unknown
  }

  export class ModuleClient {
    open(): Promise<void>
    terminate(): Promise<void>
    getPoolStats(): ModulePoolStats
  }

  export class SessionClient {
    constructor(moduleClient: ModuleClient, options?: SessionOptions)
    get(url: string, options?: RequestOptions): Promise<ResponseLike>
    post(url: string, options?: RequestOptions): Promise<ResponseLike>
    post(url: string, body: string, options?: RequestOptions): Promise<ResponseLike>
    put(url: string, options?: RequestOptions): Promise<ResponseLike>
    delete(url: string, options?: RequestOptions): Promise<ResponseLike>
    patch(url: string, options?: RequestOptions): Promise<ResponseLike>
    destroySession(): Promise<void>
  }
}
