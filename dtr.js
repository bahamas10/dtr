#!/usr/bin/env node
/**
 * Easy dtrace command builder
 *
 * Author: Dave Eddy <dave@daveeddy.com>
 * Date: February 15, 2015
 * License: MIT
 */

var fs = require('fs');
var path = require('path');
var readline = require('readline');
var spawn = require('child_process').spawn;
var util = require('util');

var Menu = require('terminal-menu');
var getopt = require('posix-getopt');
var justify = require('justify');

var package = require('./package.json');

var usage = [
  'Usage: dtr [options] [command]',
  '',
  'Node.JS wrapper around useful D scripts to lower the bar for entry for using DTrace',
  '',
  'options',
  '  -d, --debug           turn on debugging information, defaults to false',
  '  -h, --help            print this message and exit',
  '  -p, --prefix <cmd>    prefix dtrace with cmd when run, ie. "sudo" or "pfexec", defaults to nothing',
  '  -u, --updates         check for available updates',
  '  -v, --version         print the version number and exit',
  '  -w, --width <width>   the width to use for the interactive menu, defaults to 80',
].join('\n');

// command line arguments
var options = [
  'd(debug)',
  'h(help)',
  'p:(prefx)',
  'u(updates)',
  'v(version)',
  'w:(width)',
].join('');
var parser = new getopt.BasicParser(options, process.argv);

var opts = {
  debug: process.env.DTR_DEBUG,
  prefix: process.env.DTR_PREFX,
  width: +process.env.DTR_WIDTH || 80,
};
var option;
while ((option = parser.getopt()) !== undefined) {
  switch (option.option) {
    case 'd': opts.debug = true; break;
    case 'h': console.log(usage); process.exit(0); break;
    case 'p': opts.prefix = option.optarg; break;
    case 'u': // check for updates
      require('latest').checkupdate(package, function(ret, msg) {
        console.log(msg);
        process.exit(ret);
      });
      return;
    case 'v': console.log(package.version); process.exit(0); break;
    case 'w': opts.width = +option.optarg; break;
    default: console.error(usage); process.exit(1); break;
  }
}
var args = process.argv.slice(parser.optind());

// load all sections
var dir = path.join(__dirname, 'scripts');
var sections = {};
fs.readdirSync(dir).sort().forEach(function(s) {
  // read the section manifest
  var d = path.join(dir, s);
  var file = path.join(d, 'manifest.json');
  var manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  sections[manifest.name || s] = manifest;

  // read all scripts
  sections[s] = {
    caption: manifest.caption,
    scripts: {}
  };
  fs.readdirSync(d).sort().forEach(function(t) {
    if (t === 'manifest.json')
      return;
    var script = manifest.scripts[t] || {};
    if (typeof script === 'string')
      script = {caption: script};

    sections[s].scripts[t] = {
      file: path.join(d, t),
      caption: script.caption,
      pid: script.pid
    };
  });
});

switch (args[0]) {
  case undefined:
    // skip to interactive menu
    break;
  case 'list': case 'ls':
    // list all scripts
    var parts = (args[1] || '').split('/');
    var width = 35;

    // list each section
    Object.keys(sections).forEach(function(section) {
      if (parts[0] && parts[0] !== section)
        return;

      console.log('%s %s',
        justify(section, '', width),
        sections[section].caption);

      // list each script
      var scripts = sections[section].scripts;
      Object.keys(scripts).forEach(function(script) {
        if (parts[1] && parts[1] !== script)
          return;

        console.log('%s %s',
          justify(util.format('  %s/%s', section, script), '', width),
          scripts[script].caption);
      });
      console.log();
    });
    return;
  case 'cat': case 'run':
    var parts = (args[1] || '').split('/');
    var section = hap(sections, parts[0]) ? parts[0] : null;
    if (!section)
      die('section "%s" not found', parts[0]);
    var script = hap(sections[section].scripts, parts[1]) ? parts[1] : null;
    if (!script)
      die('script "%s" not found', parts[1]);

    var script = sections[section].scripts[script];
    switch (args[0]) {
      case 'cat':
        fs.createReadStream(script.file, 'utf8').pipe(process.stdout);
        break;
      case 'run':
        dtrace(script.file, +args[2] || script.pid);
        break;
    }
    return;
  default:
    console.error('unknown command: %s', args[0]);
    process.exit(1);
}

// load interactive menu
var expanded = {};
make_menu();

// create the menu
function make_menu(selected) {
  var options = [];
  var menu = new Menu({
    width: opts.width,
    x: 4,
    y: 2,
    selected: selected,
  });

  menu.reset();
  menu.write('DTR - DTrace Runner\n');
  menu.write('-------------------\n');
  menu.write('\n');

  // add each section
  Object.keys(sections).forEach(function(section) {
    menu.add(justify(section, sections[section].caption, opts.width, {c: ' '}));
    options.push({type: 'section', label: section});

    // expand all scripts in the section if the user specifies
    if (expanded[section] === true) {
      var scripts = sections[section].scripts;
      Object.keys(scripts).forEach(function(script) {
        var caption = scripts[script].caption;
        menu.add(justify('  ' + script, caption, opts.width, {c: ' '}));
        options.push({
          type: 'script',
          label: script,
          script: scripts[script],
          //file: path.join(dir, section, script)
        });
      });
    }
  });

  menu.write('\n');
  menu.add('EXIT');

  menu.on('select', function(label, selected) {
    menu.close();
    process.stdin.unpipe(menustream);
    process.stdin.setRawMode(false);
    process.stdin.removeAllListeners('data');
    process.stdin.pause();

    if (label === 'EXIT')
      process.exit(0);

    var option = options[selected];
    var name = option.label;

    // open the script with dtrace
    if (option.type === 'script') {
      dtrace(option.script.file, option.script.pid);
      return;
    }

    // clicked a section tree, toggle its expansion
    expanded[name] = !expanded[name];
    make_menu(selected);
  });

  // show the menu
  var menustream = menu.createStream();
  process.stdin.resume();
  process.stdin.pipe(menustream).pipe(process.stdout);
  process.stdin.setRawMode(true);
}

process.on('exit', cleanup);

function cleanup() {
  try {
    process.stdin.setRawMode(false);
  } catch(e) {}
}

//
// helper functions
//

// die with a message
function die() {
  console.error.apply(console, arguments);
  process.exit(1);
}

// hasOwnProperty shortcut
function hap(o, p) {
  return {}.hasOwnProperty.call(o, p);
}

// print debug messages
function debug() {
  if (opts.debug)
    return console.error('[DEBUG] %s', util.format.apply(util, arguments));
}

// spawn dtrace and hook up signals
function dtrace(file, pid) {
  // construct command args
  var args = [];
  if (opts.prefix)
    args.push(opts.prefix);
  args.push('dtrace', '-s', '/dev/stdin');

  if (pid === true) {
    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('enter PID to trace: ', function(_pid) {
      rl.close();
      go(_pid);
    });
  } else {
    go(pid);
  }

  function go(_pid) {
    if (_pid)
      args.push('-p', _pid);

    // spawn dtrace
    debug('spawning: %s', JSON.stringify(args));
    var child = spawn(args[0], args.slice(1));
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
    child.on('error', function(e) {
      die(e.message);
    });

    // read the script into stdin
    var rs = fs.createReadStream(file, 'utf8');
    rs.pipe(child.stdin);
    var data = '';
    rs.on('data', function(d) { data += d; });
    rs.on('end', function() {
      debug('script loaded from file: %s', file);
      debug('\n\n%s\n\n', data);
    });

    // hook up exit code
    child.on('close', function(code) {
      debug('child died with code %d', code);
      process.exit(code === undefined ? 1 : code);
    });

    // hook up ctrl-c handle
    process.on('SIGINT', function() {
      debug('sending SIGINT to child');
      child.kill('SIGINT');
    });
  }
}
