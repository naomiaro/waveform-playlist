var gulp = require("gulp");
var sourcemaps = require("gulp-sourcemaps");
var babel = require("gulp-babel");
var concat = require("gulp-concat");
var connect = require('gulp-connect');

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

gulp.task('default', ['connect', 'watch']);