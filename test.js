var QPool = require('./qpool');
var counter = 0;
var pool = new QPool({
	create: function () {
		console.log('creating thing');
		return {num: counter++};
	},
	init: function () {
		console.log('initting thing');
	},
	uninit: function () {
		console.log('uninitting thing');
	},
	destroy: function () {
		console.log('destroying thing');
	},
	isValid: function () {
		return true;
	},
	log: { silly: console.log, info: console.log, warn: console.log, error: console.log },
	min: 1,
	max: 3,
	cleanup: 1
});
pool.acquire().then(function (obj) {
	console.log(obj);
	pool.release(obj);

	pool.acquire(function (obj) {
		console.log(obj);
		pool.release(obj);

		queueTest();
	});
});

function queueTest() {
	var foo = [
		pool.acquire(),
		pool.acquire(),
		pool.acquire()
	];
	
	pool.acquire().then(function (obj) {
		console.log('dequeued', obj);
		pool.release(obj);

		validTest();
	});

	foo.forEach(function (obj) {
		obj.then(function (obj) {
			console.log('release', obj);
			pool.release(obj);
		});
	});
}

function validTest() {
	var reject = 2;
	pool._isValid = function () { return reject-- > 0 ? false : true; }

	pool.acquire().then(function (obj) {
		console.log('got one');
		pool.release(obj);

		pool.acquire();
		pool.acquire();
		pool.acquire();
		
		pool.acquire(function () {
			console.log('all done');
			pool.destroy();
		});
		reject = 3;
	});
}
