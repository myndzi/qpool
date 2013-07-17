/*
 *  QPool.js
 *  An object pool/queue using Q promises
 *
 */
;

// extend Object to allow use of unique objects as keys
(function() {
	if ( typeof Object.prototype.size == "undefined" ) {
		Object.prototype.size = function () {
			return Object.keys(this).length;
		};
	}
})();

module.exports =
(function () {
	var Q = require('q');
	
	function noop(val) { if (val) return function () { return val; } };
	function QPool(opts) {
		opts = opts || { };
		
		if (!opts.create) {
			throw new Error('new QPool: opts.create is required');
		}

		this._create = opts.create;
		
		this._init = opts.init || noop;
		this._uninit = opts.uninit || noop;
		this._destroy = opts.destroy || noop;
		
		this._isValid = opts.isValid || noop(true);
		
		this.log = opts.log || { silly: noop, info: noop, warn: noop, error: noop };

		this.min = opts.min || 0;
		this.max = opts.max || 10;
		
		this.timeout = (opts.timeout || 30) * 1000;
		
		this.items = { };
		this.lru = [];
		this.pending = [];
		
		// periodically validate pooled objects and destroy them
		// if they fail the validity check
		if (opts.cleanup && opts.isValid) {
			var display = true;
			this.timer = setInterval(function () {
				if (display) {
					this.log.silly('Running cleanup');
					display = false;
				}
				var destroyed = false;
				Object.keys(this.items).forEach(function (key) {
					var obj = this.items[key].obj;
					if (!this._isValid(obj)) {
						console.log('invalid object', obj);
						destroyed = true;
						this.destroyObj(obj);
					}
				}, this);
				if (destroyed) {
					display = true;
					this.cycle();
				}
			}.bind(this), opts.cleanup * 1000);
		}
		
		this.log.silly('Created new pool');
	}
	QPool.prototype.cycle = function () {
		this.log.silly('Cycling queue', {
			'Pending': this.pending.length,
			'Objects': this.items.size(),
			'Max': this.max
		});
		var next;
		while (this.pending.length && this.items.size() < this.max) {
			next = this.pending.shift();
			next.deferred.resolve(this.acquire());
		}
	};
	var id = 0;
	QPool.prototype.acquire = function () {
		var item = null,
			thenFn = null,
			args = Array.prototype.slice.call(arguments);
		
		if (args.length === 1 && typeof args[0] === 'function') {
			thenFn = args.shift();
		}

		if (this.lru.length) {
			this.log.silly('Acquiring object from LRU');
			item = this.lru.shift();
		} else if (this.items.size() < this.max) {
			this.log.silly('Instantiating a new object');
			var obj = this._create(), item;
			
			obj.id = ++id;
			item = { obj: obj, timer: null, inuse: false };
			
			this.items[obj.id] = item;
		}
		
		if (item && !this._isValid(item.obj)) {
			this.log.warn('Object wasn\'t valid, re-acquiring');
			if (obj) {
				this.log.warn('isValid failed on newly constructed object');
				return;
			}
			
			this.destroyObj(item.obj);
			return this.acquire.apply(this, arguments);
		}

		var ret;
		if (item) {
			clearTimeout(item.timer);
			item.timer = null;
			item.inuse = true;
			
			this._init.apply(item.obj, args);
			
			ret = Q(item.obj);
		} else {
			this.log.silly('Queueing request until an object is available');
			var deferred = new Q.defer();
			this.pending.push({
				deferred: deferred,
				args: args
			});
			ret = deferred.promise;
		}
		
		if (thenFn) return ret.then(thenFn);
		else return ret;
	};
	QPool.prototype.release = function (obj) {
		var item = this.items[obj.id];
		
		if (!item) {
			this.log.warn('QPool.release: No such item');
			return;
		}
		if (!item.inuse) {
			this.log.warn('QPool.release: Released an item that wasn\'t in use');
			return;
		}
		
		if (this.pending.length) {
			this.log.silly('Reusing object for pending request');
			var next = this.pending.shift();
			this._init.apply(item.obj, next.args);
			next.deferred.resolve(item.obj);
		} else  {
			this.log.silly('Releasing object to pool');
			item.inuse = false;
			if (this.lru.length >= this.min) {
				this.log.silly('Setting idle timer for superfluous object');
				item.timer = setTimeout(function () {
					this.log.silly('Pooled object timed out, destroying');
					this.destroyObj(obj);
				}.bind(this), this.timeout);
			}

			this._uninit.apply(item.obj);
			this.lru.push(item);
		}
	};
	QPool.prototype.destroyObj = function (obj) {
		var item = this.items[obj.id];
		if (!item) {
			this.log.warn('Destroy called on nonexistent item');
			return;
		}
		
		clearTimeout(item.timer);
		delete this.items[obj.id];
		
		this._destroy.call(obj);
	};
	QPool.prototype.destroy = function () {
		this.log.silly('Destroying pool');
		
		clearInterval(this.timer);
		this.timer = null;
		
		this.log.silly('Rejecting pending promises');
		this.pending.forEach(function (item) {
			item.deferred.reject('Pool destroyed');
		});
		this.pending = null;
		
		this.log.silly('Destroying pooled objects: ' + Object.keys(this.items));
		this.log.silly(this.items);
		Object.keys(this.items).forEach(function (key) {
			this.destroyObj(this.items[key].obj);
		}, this);
		this.items = null;
		
		this.lru = null;
		this.log.silly('Done');
	};
	
	return QPool;
})();
