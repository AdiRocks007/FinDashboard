/**
 * Global API Request Queue
 * Ensures all API requests are spaced 2 seconds apart to prevent rate limiting
 */

interface QueuedRequest {
  url: string
  options: RequestInit
  resolve: (value: Response) => void
  reject: (error: Error) => void
  retries: number
}

class APIRequestQueue {
  private queue: QueuedRequest[] = []
  private isProcessing = false
  private lastRequestTime = 0
  private readonly MIN_DELAY_MS = 2000 // 2 seconds between requests
  private readonly MAX_RETRIES = 3
  private readonly RETRY_DELAY_MS = 2000

  /**
   * Add a request to the queue
   */
  async enqueue(url: string, options: RequestInit = {}): Promise<Response> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        url,
        options,
        resolve,
        reject,
        retries: 0,
      })
      
      this.processQueue()
    })
  }

  /**
   * Process the queue with rate limiting
   */
  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return
    }

    this.isProcessing = true

    while (this.queue.length > 0) {
      const request = this.queue.shift()!
      
      // Calculate delay needed since last request
      const timeSinceLastRequest = Date.now() - this.lastRequestTime
      const delayNeeded = Math.max(0, this.MIN_DELAY_MS - timeSinceLastRequest)
      
      if (delayNeeded > 0) {
        console.log(`⏳ [API QUEUE] Waiting ${delayNeeded}ms before next request...`)
        await new Promise(resolve => setTimeout(resolve, delayNeeded))
      }

      try {
        console.log(`📡 [API QUEUE] Processing request: ${request.url.substring(0, 100)}`)
        this.lastRequestTime = Date.now()
        
        const response = await fetch(request.url, request.options)
        
        // Handle rate limiting with retry
        if (response.status === 429) {
          if (request.retries < this.MAX_RETRIES) {
            console.log(`⚠️ [API QUEUE] Rate limited, retrying (${request.retries + 1}/${this.MAX_RETRIES})...`)
            request.retries++
            // Wait longer before retry
            await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS * (request.retries + 1)))
            // Re-queue the request
            this.queue.unshift(request)
            continue
          } else {
            console.error(`❌ [API QUEUE] Max retries reached for: ${request.url}`)
            request.reject(new Error(`Rate limit exceeded. Please try again later.`))
            continue
          }
        }

        // Handle other errors
        if (!response.ok && response.status >= 500) {
          // Server errors - retry
          if (request.retries < this.MAX_RETRIES) {
            console.log(`⚠️ [API QUEUE] Server error ${response.status}, retrying...`)
            request.retries++
            await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS))
            this.queue.unshift(request)
            continue
          }
        }

        console.log(`✅ [API QUEUE] Request successful: ${response.status}`)
        request.resolve(response)
      } catch (error) {
        // Network errors - retry
        if (request.retries < this.MAX_RETRIES) {
          console.log(`⚠️ [API QUEUE] Network error, retrying (${request.retries + 1}/${this.MAX_RETRIES})...`)
          request.retries++
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS))
          this.queue.unshift(request)
          continue
        } else {
          console.error(`❌ [API QUEUE] Request failed after retries:`, error)
          request.reject(error instanceof Error ? error : new Error('Request failed'))
        }
      }
    }

    this.isProcessing = false
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      timeSinceLastRequest: Date.now() - this.lastRequestTime,
    }
  }

  /**
   * Clear the queue
   */
  clear() {
    this.queue.forEach(request => {
      request.reject(new Error('Request queue cleared'))
    })
    this.queue = []
    this.isProcessing = false
  }
}

// Global singleton instance
export const apiRequestQueue = new APIRequestQueue()

/**
 * Wrapper function for fetch that uses the global queue
 */
export async function queuedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return apiRequestQueue.enqueue(url, options)
}

