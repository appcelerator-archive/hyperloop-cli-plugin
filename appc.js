var props = ['publish'];

props.forEach(function (prop) {
	Object.defineProperty(exports, prop, {
		configurable: true,
		enumerable: true,
		get: function () {
			return require('./lib/' + prop);
		},
		set: function (v) {
			exports[prop] = v;
		}
	});
});
