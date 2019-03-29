/**
 *	WPPB GENERATOR SITE
 *	Author: Enrique Chavez
 *	Author URI: http://enriquechavez.co
 */

var express = require('express');
var project = express();
var port = process.env.PORT || 3000;
var path = require('path');
var ghdownload = require('github-download');
var rimraf = require('rimraf');
var fs = require('fs-extra');
var mime = require('mime');
var replace = require('replace');
var bodyParser = require('body-parser');
var EasyZip = require('easy-zip').EasyZip;
var CronJob = require('cron').CronJob;
var ua = require('universal-analytics');

project.set('port', port);
project.set('view engine', 'ejs');
project.set('views', path.join(__dirname, 'views'));

project.use(express.static(__dirname + '/public'));
project.use(bodyParser.urlencoded({
  extended: true
}));

/*
project
  .route(
    '/.well-known/acme-challenge/miU-q9A8ox1btoayRB8tM6wcWPisl42aR4wnixiK2UU'
  )
  .get(function (req, res) {
    res.send(
      'miU-q9A8ox1btoayRB8tM6wcWPisl42aR4wnixiK2UU.9s9UoMhX5iRzhJpZG6oAd-7PRFIBTPxbwd7nVTPfGcM'
    );
  });
*/

project
  .route('/')
  //GET REQUEST DRAW THE HOME PAGE
  .get(function (req, res) {
    res.render('index');
  }) // END GET ROUTE

  .post(function (req, res) {
    var origin = process.cwd() + '/source/';

    var data = req.body;

    console.log(req);

    var plugin_slug = (String(data.slug).length) ? String(data.slug).toLowerCase() : '';

    var plugin_name = String(data.name);
    var plugin_uri = String(data.uri);
    var plugin_description = String(data.description);
    var plugin_version = (plugin_instance + '_VERSION').toUpperCase();

    var plugin_package = capitalize(plugin_slug);
    var plugin_instance = plugin_slug.replace(/-/gi, '_');

    var plugin_author = String(data.author.name);
    var plugin_author_uri = String(data.author.uri);
    var plugin_author_email = String(data.author.email);
    var plugin_author_full = plugin_author + ' <' + plugin_author_email + '>';

    var destination = process.cwd() + '/tmp/' + plugin_slug + '-' + new Date().getTime();
    var visitor = ua('UA-XXXXXXXX-1');

    //Track Event
    visitor.event('build', 'click', 'download', 1).send();

    fs.copy(origin, destination, function (err) {
      if (err) {
        console.error(err);

        return;
      }

      //RENAME THE MAIN PLUGIN DIRECTORY
      fs.renameSync(destination + '/__PLUGIN_FILENAME__', destination + '/' + plugin_slug);

      //FIND AND REPLACE FILES NAMES
      walker(destination + '/' + plugin_slug, function (err, files) {
        if (err) {
          console.error(err);

          return;
        }

        files.forEach(function (file) {
          var newName;
          var re = /__PLUGIN_FILENAME__/gi;

          newName = file.replace(re, plugin_slug);
          fs.renameSync(file, newName);
        });

        // Plugin URI
        replace({
          regex: '__PLUGIN_URI__',
          replacement: plugin_uri,
          paths: [destination + '/' + plugin_slug + '/' + plugin_slug + '.php'],
          recursive: false,
          silent: true
        });

        // Plugin Name
        replace({
          regex: '__PLUGIN_NAME__',
          replacement: plugin_name,
          paths: [destination + '/' + plugin_slug + '/' + plugin_slug + '.php'],
          recursive: true,
          silent: true
        });

        //find Plugin Author
        replace({
          regex: '__PLUGIN_AUTHOR_NAME__',
          replacement: plugin_author,
          paths: [destination + '/' + plugin_slug + '/' + plugin_slug + '.php'],
          recursive: true,
          silent: true
        });

        //find Plugin Author Full
        replace({
          regex: '__PLUGIN_AUTHOR_FULL__',
          replacement: plugin_author_full,
          paths: [destination + '/' + plugin_slug],
          recursive: true,
          silent: true
        });

        //find Plugin Name
        replace({
          regex: '__PLUGIN_NAME__',
          replacement: plugin_package,
          paths: [destination + '/' + plugin_slug],
          recursive: true,
          silent: true
        });

        //find Plugin Description
        replace({
          regex: '__PLUGIN_DESCRIPTION__',
          replacement: plugin_description,
          paths: [destination + '/' + plugin_slug],
          recursive: true,
          silent: true
        });

        //find Plugin slug
        replace({
          regex: '__PLUGIN_SLUG__',
          replacement: plugin_slug,
          paths: [destination + '/' + plugin_slug],
          recursive: true,
          silent: true
        });

        //find Author URI
        replace({
          regex: '__PLUGIN_AUTHOR_URI__',
          replacement: plugin_author_uri,
          paths: [destination + '/' + plugin_slug],
          recursive: true,
          silent: true
        });

        //find Plugin Version
        replace({
          regex: '__PLUGIN_VERSION__',
          replacement: plugin_version,
          paths: [destination + '/' + plugin_slug],
          recursive: true,
          silent: true
        });

        //Replace done ZIP it
        var zip = new EasyZip();

        zip.zipFolder(destination + '/' + plugin_slug, function () {
          zip.writeToResponse(res, plugin_slug);
        });
      });
    });
  }); //END ROUTE

/**
 * CRON JOB TO GET NEW CODE FROM GITHUB EVERY DAY AT 1:30AM
 */
var job = new CronJob(
  '30 1 * * *',
  function () {
    //GET FRESH CODE
    getSourceCode();
  },
  true,
  'America/Los_Angeles'
);

job.start();

/**
 * CRON JOB TO CLEAN THE TMP FOLDER EVERY HOUR
 */

var clean = new CronJob(
  '0 * * * *',
  function () {
    var destination = process.cwd() + '/tmp/';
    rimraf(destination, function () {});
  },
  true,
  'America/Los_Angeles'
);

clean.start();

/**
 * GET PLUGIN CODE FROM GITHUB
 */
var getSourceCode = function () {
  var repo = {
    user: 'NunoCodex',
    repo: 'WordPress-Plugin-Boilerplate',
    ref: 'master'
  };

  var destination = process.cwd() + '/source/';

  //DELETE OLD CODE
  rimraf(destination, function () {});

  //GET THE NEW CODE FORM THE REPO
  ghdownload(repo, destination)
    .on('zip', function (zipUrl) {
      console.log('zip: ' + zipUrl);
    })

    .on('error', function (err) {
      console.error('error ' + err);
    })

    .on('end', function () {
      console.log('Finish Github Download ');
    });
};

/**
 * RECURSIVE WALKER TO GET ALL THE FILES IN DIRECTORY
 */
var walker = function (dir, done) {
  var results = [];

  fs.readdir(dir, function (err, list) {
    if (err) return done(err);

    var i = 0;

    (function next() {
      var file = list[i++];

      if (!file) return done(null, results);

      file = dir + '/' + file;

      fs.stat(file, function (err, stat) {
        if (stat && stat.isDirectory()) {
          walker(file, function (err, res) {
            results = results.concat(res);

            next();
          });
        } else {
          results.push(file);

          next();
        }
      });
    })();
  });
};

var capitalize = function (name) {
  var newName = '';

  name = name.replace(/-/gi, ' ');
  pieces = name.split(' ');
  pieces.forEach(function (word) {
    newName += word.charAt(0).toUpperCase() + word.slice(1) + ' ';
  });

  return newName.trim().replace(/ /gi, '_');
};

// On Init get initial code
getSourceCode();

//Start web project.
project.listen(project.get('port'), function () {
  console.log('Node app is running at localhost:' + project.get('port'));
});
