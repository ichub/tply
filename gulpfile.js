"use strict";

let gulp = require("gulp");
let sass = require("gulp-sass");
let server = require('gulp-server-livereload');
let watch = require("gulp-watch");
let babel = require('gulp-babel');
let browserify = require('gulp-browserify');
let jshint = require('gulp-jshint');
let glob = require("multi-glob").glob;
let path = require("path");

let sassGlob = './sass/**/*.scss';
let jsGlob = "./src/**/*.js";

let sassOutputGlob = './css/**/*.css';
let jsOutputGlob = './dist/**/*.js';

function swallowError(error) {

    // If you want details of the error in the console
    console.log(error.toString());

    this.emit('end');
}

gulp.task('sass', () => {
    gulp.src(sassGlob)
        .pipe(sass().on('error', sass.logError))
        .pipe(gulp.dest('./css'));
});

gulp.task('js', () => {
    return gulp.src(jsGlob)
        .pipe(babel({
            presets: ['es2015'],
            highlightCode: false
        }))
        .on('error', swallowError)
        .pipe(browserify({
            insertGlobals: true
        }))
        .pipe(gulp.dest('dist'));
});

gulp.task("watch", ['sass', 'js'], () => {
    gulp.watch(sassGlob, ['sass']);
    gulp.watch(jsGlob, ['js']);
});

gulp.task('serve', ["watch"], () => {
    gulp.src('./')
        .pipe(server({
            livereload: {
                enable: true,
                filter: function (filePath, cb) {
                    glob([jsOutputGlob, sassOutputGlob], function (err, files) {
                        cb(files.map(function (file) {
                                return path.resolve(file);
                            }).indexOf(filePath) > -1);
                    });
                }
            },
            open: true
        }));
});

gulp.task('lint', function () {
    return gulp.src('./src/*.js')
        .pipe(jshint('.jshintrc'))
        .pipe(jshint.reporter('jshint-stylish'));
});