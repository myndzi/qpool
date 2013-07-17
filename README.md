#QPool
QPool is a generic object pool that returns Q promises.

##Usage

    var QPool = require('qpool'),
    	pool = new QPool({
			create: function () { return new Foo(); }
		});
	
	function Foo() {
		this.bar = true;
	}
	
	pool.acquire().then(function (foo) {
		// do something with foo
		pool.release(foo);
	});

You can pass initialization options to the object via pool.acquire:

    pool.acquire(arg1, arg2...).then(function () { ... });

Or, as a convenience, you can specify the 'then' function:

    pool.acquire(function (foo) { ... });

QPool takes the following options:

* `create` - a function that creates the object to be pooled (*required*)
* `init` - a function that initializes the object to be pooled
* `uninit` - a function that cleans up an object after it has been used and is being returned to the pool
* `destroy` - a function that destroys the object entirely
* `isValid` - a function that returns whether the object is (still) valid
* `log` - supply an object with four methods: silly, info, warn, error
* `min` - allows you to maintain a minimum quantity of uninitialized objects in the pool (default: 0)
* `max` - the maximum number of objects to instantiate; further requests will be queued and served when available (default: 10)
* `timeout` - a value in seconds to persist objects that have been returned to the pool when they exceed the minimum setting (default: 30)
* `cleanup` - an interval in seconds; if specified, every <cleanup> seconds the instantiated objects will be tested with the isValid function. objects that fail will be destroyed

##Methods

###QPool.acquire(args || fn)
Acquire an object from the pool. If an idle object is available, will return a fulfilled promise with that object. If not, will instantiate a new object if possible using the `create` callback and return a fulfilled promise with that. Otherwise, return an unfulfilled promise that will become filled when an object becomes available.

If specified, the `init` callback will be called with the object as 'this' first.

If a single function argument is given, this is appended to the promise as a '.then' clause. Otherwise, arguments are passed to the specified init function if given.

###QPool.release(object)
Releases an object back into the pool. The `uninit` callback will be called with the object as 'this' first.

Call this when done if you know what's good for you.

###QPool.destroy()
Destroys the object pool. This will reject all pending promises and destroy all instantiated objects.
