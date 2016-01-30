"use strict";

let gulp = require("gulp");
let sass = require("gulp-sass");
let server = require('gulp-server-livereload');
let watch = require("gulp-watch");
let browserify = require('gulp-browserify');
let glob = require("multi-glob").glob;
let path = require("path");
let commandLineArgs = require('command-line-args');
let gulpif = require('gulp-if');
let uglify = require('gulp-uglify');
let cssnano = require('gulp-cssnano');
let ts = require('gulp-typescript');
let merge = require('merge2');
let tslint = require("gulp-tslint");
let tsfmt = require("gulp-tsfmt");
let changedInPlace = require("gulp-changed-in-place");

let cli = commandLineArgs([
    {name: 'production', alias: 'p', type: Boolean, defaultOption: false}
]);

let options = cli.parse();

let sassGlob = './sass/**/*.scss';
let tsGlob = "./src/**/*.ts";

let sassOutputGlob = './css/**/*.css';
let tsOutputGlob = './dist/**/*.ts';
let htmlGlob = './index.html';

function swallowError(error) {

    // If you want details of the error in the console
    console.log(error.toString());

    this.emit('end');
}

gulp.task('sass', () => {
    gulp.src(sassGlob)
        .pipe(sass().on('error', sass.logError))
        .pipe(gulpif(options.production, cssnano()))
        .pipe(gulp.dest('./css'));
});

gulp.task('ts', function () {
    var tsResult = gulp.src('src/**/*.ts')
        .pipe(ts({
            declaration: true,
            noExternalResolve: true
        }));

    return merge([
        tsResult.dts.pipe(gulp.dest('dist')),
        tsResult.js
            .pipe(browserify({
                insertGlobals: false
            }))
            .pipe(gulpif(options.production, uglify()))
            .pipe(gulp.dest('dist'))
    ]);
});


gulp.task("watch", ['sass', 'ts'], () => {
    gulp.watch(sassGlob, ['sass']);
    gulp.watch(tsGlob, ['ts']);
});

gulp.task('serve', ["watch"], () => {
    gulp.src('./')
        .pipe(server({
            livereload: {
                enable: true,
                filter: function (filePath, cb) {
                    glob([tsOutputGlob, sassOutputGlob, htmlGlob], function (err, files) {
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
    return gulp.src('./src/**/*.ts')
        .pipe(tslint())
        .pipe(tslint.report("prose", {
            emitError: false
        }))
});

gulp.task('format', () => {
    gulp.src('src/**/*.ts')
        .pipe(tsfmt({
            options: {}}))
        .pipe(gulp.dest(file => path.dirname(file.path)));
});

gulp.task('default', ['serve']);