var gulp = require("gulp");
var sourcemaps = require("gulp-sourcemaps");
var babel = require("gulp-babel");
var concat = require("gulp-concat");
var connect = require('gulp-connect');
var mocha = require('gulp-mocha');
var util = require('gulp-util');

gulp.task('connect', function() {
  connect.server({
    root: 'examples',
    port: 8000,
    livereload: true
  });
});

gulp.task('src', function () {
  gulp.src("./src/**/*.js")
    .pipe(sourcemaps.init())
    .pipe(babel())
    .pipe(concat("waveform-playlist.js"))
    .pipe(sourcemaps.write("."))
    .pipe(gulp.dest("dist"));
});
 
gulp.task('html', function () {
  gulp.src('./examples/*.html')
    .pipe(connect.reload());
});
 
gulp.task('watch', function () {
  gulp.watch(['./examples/*.html'], ['html']);
  gulp.watch(['./src/**/*.js'], ['src']);
});

gulp.task('test', function () {
  return gulp.src(['test/**/*.js'], { read: false })
    .pipe(mocha({ reporter: 'spec' }))
    .on('error', util.log);
});
 
gulp.task('watch-test', function () {
  gulp.watch(['views/**', 'public/**', 'app.js', 'framework/**', 'test/**'], ['test']);
});

gulp.task('default', ['connect', 'watch']);