const { logger } = require('./logger');
const { isRequierdEnvs, ignoreFile } = require('./functions');
const { runsubtitlesTasks } = require('./subtitles/subtitlesTasks');
const { runBazarrTasks } = require('./services/bazarr');
const { runJellyfinTasks } = require('./services/jellyfin');

if (!isRequierdEnvs()) process.exit();

(async function () {
	logger.info(`Starting post import tasks`);
	await ignoreFile();
	await runsubtitlesTasks();
	await runBazarrTasks();
	await runJellyfinTasks();
	await ignoreFile('delete');
	logger.info(`Finished post import tasks`);
})()