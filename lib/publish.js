var fs = require('fs'),
	path = require('path');

module.exports = {
	name: 'Hyperloop',
	type: 'hyperloop_module',
	find: find,
	execute: publish
};

/**
 * only call our plugin if this is a hyperloop module project
 */
function find (appc, opts) {
	var dir = opts.projectDir || process.cwd();
	if (appc.AppCJS.exists(dir)) {
		var app = appc.AppCJS.load(dir);
		if (app.type === 'timodule' && app.group === 'hyperloop') {
			var pkg = require(path.join(dir, 'package.json'));
			return [{
				name: app.type + '/' + pkg.name + '@' + pkg.version,
				value: {
					name: pkg.name,
					type: app.type,
					version: pkg.version,
					dir: dir,
					plugin: module.exports
				}}];
		}
	}
}

function publish (appc, args, opts, callback) {
	var spawn = require('child_process').spawn;
	var gulp = require.resolve('.bin/gulp');
	var gulpfile = path.join(opts.component.dir, 'gulpfile.js');
	var child = spawn (gulp, [], {cwd: opts.component.dir});
	var re = /\[\d{2}:\d{2}:\d{2}\]\s/g;
	child.stdout.on('data', function (buf) {
		buf = buf.toString().replace(/\n$/, '').replace(re, '').trim();
		buf && appc.log.trace(appc.chalk.cyan('[gulp] ') + buf);
	});
	child.stderr.on('data', function (buf) {
		buf = buf.toString().replace(/\n$/, '').replace(re, '').trim();
		buf &&appc.log.error(appc.chalk.cyan('[gulp] ') + buf);
	});
	child.on('error', callback);
	child.on('exit', function (ec) {
		if (ec !== 0) {
			return callback(new Error('build failed running ' + gulp + ' ' + gulpfile));
		}
		opts.pkg = require(path.join(opts.component.dir, 'package.json'));
		appc.publish.publish(appc, opts, opts.component.dir, false, function (err) {
			callback(err, opts.component);
		});
	});
}
