/**
 * Request Queue Service
 * Serializes API calls with minimum delay between requests
 * to prevent rate limit hammering (learned from Vixxxen Seedream route)
 */

class RequestQueue {
  constructor(minDelayMs = 1000) {
    this.queue = [];
    this.processing = false;
    this.minDelayMs = minDelayMs;
    this.lastRequestTime = 0;
  }

  async add(requestFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ requestFn, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const { requestFn, resolve, reject } = this.queue.shift();
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;

      if (timeSinceLastRequest < this.minDelayMs) {
        await new Promise(r => setTimeout(r, this.minDelayMs - timeSinceLastRequest));
      }

      try {
        this.lastRequestTime = Date.now();
        const result = await requestFn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.processing = false;
  }

  get size() {
    return this.queue.length;
  }
}

/**
 * Per-Agency Queue Manager
 * Maintains a separate RequestQueue per agency to prevent one busy agency
 * from blocking others. Idle queues are cleaned up automatically.
 */
class PerAgencyQueue {
  constructor(minDelayMs = 1000, idleTimeoutMs = 5 * 60 * 1000) {
    this.minDelayMs = minDelayMs;
    this.idleTimeoutMs = idleTimeoutMs;
    this.queues = new Map();
    this.timers = new Map();
  }

  _getQueue(agencyId) {
    if (!this.queues.has(agencyId)) {
      this.queues.set(agencyId, new RequestQueue(this.minDelayMs));
    }
    // Reset idle cleanup timer
    if (this.timers.has(agencyId)) {
      clearTimeout(this.timers.get(agencyId));
    }
    this.timers.set(agencyId, setTimeout(() => {
      this.queues.delete(agencyId);
      this.timers.delete(agencyId);
    }, this.idleTimeoutMs));

    return this.queues.get(agencyId);
  }

  async add(agencyId, requestFn) {
    const queue = this._getQueue(agencyId);
    return queue.add(requestFn);
  }

  size(agencyId) {
    const queue = this.queues.get(agencyId);
    return queue ? queue.size : 0;
  }

  get totalQueues() {
    return this.queues.size;
  }
}

module.exports = { RequestQueue, PerAgencyQueue };
