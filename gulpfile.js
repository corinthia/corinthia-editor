/*jshint node:true */
/*jslint node:true */
'use strict';

var gulp = require('gulp');
var ts = require('gulp-typescript');
var sourcemaps = require('gulp-sourcemaps');
var merge = require('merge2');
var webserver = require('gulp-webserver');

var tsProject = ts.createProject('tsconfig.json');

gulp.task('typescript', function () {
	var tsResult = tsProject.src() // instead of gulp.src(...)
		.pipe(ts(tsProject));
	
    return merge([
        tsResult.dts.pipe(gulp.dest('build')),
        tsResult.js
            .pipe(sourcemaps.init())
            .pipe(sourcemaps.write('.'))
            .pipe(gulp.dest('build'))
    ]);
});

gulp.task('watch', ['typescript'], function () {
    gulp.watch('src/*.ts', ['typescript']);
});

/*gulp.task('serve', ['watch'], function () {
    gulp.src('.')
        .pipe(webserver({
            livereload: true,
            directoryListing: true,
            open: true
        }));
});*/

gulp.task('serve', ['watch'], function () {
    gulp.src('.')
        .pipe(webserver({
            livereload: true,
            directoryListing: true,
            open: true
        }));
});
