/**
 * @author    Marco Turi <marco.turi@hotmail.it>
 * @author    Damien Dell'Amico <damien.dellamico@saldiprivati.com>
 * @copyright Copyright (c) 2016
 * @license   GPL-3.0
 */
'use strict';

import del from 'del';
import rev from 'gulp-rev';
import gulp from 'gulp';
import util from 'gulp-util';
import size from 'gulp-size';
import gulpif from 'gulp-if';
import usemin from 'gulp-usemin';
import inject from 'gulp-inject';
import minifyCss from 'gulp-clean-css';
import runSequence from 'run-sequence';
import replace from 'gulp-replace';
import shell from 'gulp-shell';
import path from '../paths';

const LOG = util.log;
const COLORS = util.colors;
const argv = util.env;

let ENV = !!argv.env ? argv.env.toLowerCase() : 'dev';
let PLATFORM = !!argv.platform ? argv.platform.toLowerCase() : 'web';
let SKIP_CHECK = !!argv.nochk ? argv.nochk : 'false';
let API = !!argv.api ? argv.api.toLowerCase() : 'prod';

if (!PLATFORM.match(new RegExp(/android|ios|web/))) {
    LOG(COLORS.red(`Error: The argument 'platform' has incorrect value ${PLATFORM}! Usage: --platform=(android|ios|web)`));
    process.exit(1);
}

if (!ENV.match(new RegExp(/prod|dev|test/))) {
    LOG(COLORS.red(`Error: The argument 'env' has incorrect value ${ENV}! Usage: --env=(dev|test|prod)`));
    process.exit(1);
}

if (!API.match(new RegExp(/prod|stage|mock/))) {
    LOG(COLORS.red(`Error: The argument 'api' has incorrect value ${API}! Usage: --api=(prod|stage|mock)`));
    process.exit(1);
}
/**
 * Check if dependences are updated, usefull in big teams, but adds 10-15 sec of delay
 */
gulp.task('checkDep', shell.task([
    `npm install && bower install`
]));

/**
 * The 'clean' task delete 'www' directory.
 *
 * @param {Function} cb - callback when complete
 */
gulp.task('clean', (cb) => {
    const files = [].concat(path.build.basePath + '**/*');
    LOG('Cleaning: ' + COLORS.blue(files));

    return del(files, cb);
});

/**
 * The 'copy' task for images
 *
 * @return {Stream}
 */
gulp.task('images', () => {
    return gulp.src(path.app.images)
        .pipe(gulp.dest(path.build.dist.images));
});

/**
 * The 'copy' task for json fixtures
 *
 * @return {Stream}
 */
gulp.task('fixtures', () => {
    return gulp.src(path.app.json)
        .pipe(gulpif(ENV === 'dev', gulp.dest(path.build.dist.scripts)));
});

/**
 * The 'copy' task for fonts
 *
 * @return {Stream}
 */
gulp.task('fonts', () => {
    return gulp.src([].concat(path.app.fonts,path.app.ionicFonts))
        .pipe(gulp.dest(path.build.dist.fonts));
});

/**
 * The 'config' task is to configure environment by injecting
 * global env variable into the `index.html`.
 *
 * @return {Stream}
 */
gulp.task('config', () => {
    const mock = API === 'mock';
    return gulp.src(path.app.config)
        .pipe(inject(gulp.src('.'), {
            starttag: '/* inject:env */',
            endtag: '/* endinject */',
            transform: () => `const mock = ${mock};\n\tconst environment = '${ENV}';\n\tconst api = '${API}';`
        }))
        .pipe(gulp.dest(path.app.configFolder));
});

/**
 * The 'compile' task compile all js, css and html files.
 *
 * 1. it inject bundle into `index.html`
 * 2. css      - minify, add revision number
 *    js       - annotates the sources before minifying, minify, add revision number, add banner header
 *    html     - replace local path with CDN url, minify
 *
 * @return {Stream}
 */
gulp.task('html', () => {
    return gulp.src(path.app.html)
        .pipe(gulpif(ENV === 'prod', replace(/<body /, '<body ng-strict-di ')))
        .pipe(inject(gulp.src(path.build.dist.scriptsBuildOrder, {read: false}), {
            starttag: '<!-- inject:build:js -->',
            ignorePath: ['www'],
            addRootSlash: false
        }))
        .pipe(usemin({
            css: [
                gulpif(argv.prod, minifyCss({keepSpecialComments: 0})),
                gulpif(argv.prod, rev())
            ],
            jsTemplate: [
                gulpif(argv.prod, rev())
            ],
            jsVendor: []
        }))
        .pipe(gulp.dest(path.build.dist.basePath))
        .pipe(size({title: 'compile', showFiles: true}));
});

/**
 * The 'build' task gets app ready for deployment by processing files
 * and put them into directory ready for production.
 *
 * @param {Function} cb - callback when complete
 */
gulp.task('build', (cb) => {
    const firstTask = SKIP_CHECK === 'false' ? ['clean', 'checkDep'] : ['clean'];

    runSequence(
        firstTask,
        ['config'],
        ['sass', 'scripts', 'templates'],
        ['html', 'images', 'fonts', 'fixtures'],
        cb
    );
});
