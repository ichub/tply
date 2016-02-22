"use strict";

const gulp = require("gulp");
const sass = require("gulp-sass");
const server = require('gulp-server-livereload');
const watch = require("gulp-watch");
const browserify = require('gulp-browserify');
const glob = require("multi-glob").glob;
const path = require("path");
const commandLineArgs = require('command-line-args');
const gulpif = require('gulp-if');
const uglify = require('gulp-uglify');
const cssnano = require('gulp-cssnano');
const ts = require('gulp-typescript');
const merge = require('merge2');
const tslint = require("gulp-tslint");
const tsfmt = require("gulp-tsfmt");
const changedInPlace = require("gulp-changed-in-place");
const babel = require('gulp-babel');
const rename = require("gulp-rename");

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
            noExternalResolve: true,
            module: "commonjs",
            target: "es6"
        }));

    return merge([
        tsResult.dts.pipe(gulp.dest('dist')),
        tsResult.js
            .pipe(babel({
                presets: ['es2015']
            }))
            .pipe(browserify({
                insertGlobals: false
            }))
            .pipe(gulp.dest('dist'))
            .pipe(uglify())
            .pipe(rename(function (path) {
                path.basename += ".min"
            }))
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
    return gulp.src('./src/*.ts')
        .pipe(tslint())
        .pipe(tslint.report("verbose", {
            emitError: false
        }))
});

gulp.task('format', () => {
    gulp.src('src/**/*.ts')
        .pipe(tsfmt({
            options: {}
        }))
        .pipe(gulp.dest(file => path.dirname(file.path)));
});

gulp.task('default', ['serve']);