var unzip = require('unzip'),
	fs = require('fs'),
	path = require('path'),
	stream = require('stream'),
	util = require('util'),
	spawn = require('child_process').spawn;

var Transform = stream.Transform || require('readable-stream').Transform;

function Replaceable(options) {
	// allow use without new
	if (!(this instanceof Replaceable)) {
		return new Replaceable(options);
	}

	// init Transform
	Transform.call(this, options);
	this.name = options.name;
}
util.inherits(Replaceable, Transform);

Replaceable.prototype._transform = function (chunk, enc, cb) {
	chunk = chunk.toString();
	chunk = chunk.replace(/ti\.test/g, this.name);
	chunk = chunk.replace(/ti\/test/g, this.name.replace(/\./g, '/'));
	this.push(chunk);
	cb();
};

module.exports = {
	type: 'hyperloop',
	order: 100,
	subtype: 'module',
	name: 'Hyperloop Module',
	skipACS: true,
	fields: [
		{
			type: 'input',
			name: 'name',
			message: 'What\'s the module name?',
			validate: function (input) {
				if (!input) {
					return 'You must specify a name!';
				}
				if (input.match(/[^a-z0-9\-_\.]/i)) {
					return 'Names can only contain A-Z, 0-9, . and - and _ characters.';
				}
				if (input.indexOf('.') < 0) {
					return 'Names should be namespaced such as com.foo.bar';
				}
				return true;
			},
			flags: '-n, --name <name>',
			description: 'name of the module'
		}
	],
	execute: execute,
	provisioned: provisioned
};

function execute (appc, args, opts, callback) {
	appc.log.level(opts.logLevel || 'info');
	var dirname = path.join(opts.directory || process.cwd(), opts.name);
	if (!fs.existsSync(dirname)) {
		appc.wrench.mkdirSyncRecursive(dirname);
	}
	var pkg = opts.name.split('.').slice(0, -1).join('/');
	var name = opts.name.split('.').slice(-1)[0];
	appc.log.debug('fetching https://github.com/appcelerator/hyperloop-module-template/zipball/master');
	appc.request
		.get('https://github.com/appcelerator/hyperloop-module-template/zipball/master')
		.on('error', callback)
		.pipe(unzip.Parse())
		.on('entry', function (entry) {
			var type = entry.type;
			var filename = path.join(dirname, entry.path.split('/').slice(1).join('/'));
			filename = filename.replace(/ti\/test/g, pkg + '/' + name);
			filename = filename.replace(/ios\/ti/g, 'ios/' + pkg);
			filename = filename.replace(/android\/ti/g, 'android/' + pkg);
			if (type === 'Directory' && !fs.existsSync(filename)) {
				appc.wrench.mkdirSyncRecursive(filename);
			} else if (type === 'File') {
				// write out the file
				appc.log.trace('extracting', filename);
				// token replace ti.test -> name
				entry.pipe(new Replaceable({
					name: opts.name
				}))
				.pipe(fs.createWriteStream(filename));
			}
			entry.autodrain();
		})
		.on('close', function () {
			appc.log.info('running npm install ... ');
			var child = spawn('npm', ['install'], {cwd:dirname});
			child.on('error', callback);
			child.stdout.on('data', function (buf) {
				buf = buf.toString().replace(/\n$/, '').trim();
				buf && appc.log.debug('[npm] ' + buf);
			});
			child.stderr.on('data', function (buf) {
				buf = buf.toString().replace(/\n$/, '').trim();
				if (buf && buf !== 'npm' && buf.indexOf('deprecated ') < 0) {
					appc.log.error('[npm] ' + buf);
				}
			});
			child.on('close', callback);
		});
}

function provisioned (appc, type, opts, config, callback) {
	callback();
}
