const request = require('requestretry');
const envs = require('./../environments');
const { logger } = require('./../logger');
const { insertSpacesCamel } = require('./../utils');

const jellyRequest = async (path, opts = {}) => {
	try {
		if (!envs.jellyfinAddress || !envs.jellyfinApiKey) {
			logger.warn(`Jellyfin IP:PORT/API Key not found in Skiping...`)
			return false;
		}
		opts['headers'] = {
			"Authorization": `MediaBrowser Token=${envs.jellyfinApiKey}`
		}
		opts.maxAttempts = 3;
		opts.fullResponse = true;
		opts.json = true;

		const res = await request(`${envs.jellyfinAddress}/${path}`, opts);
		if (res.statusCode < 200 || res.statusCode >= 300) {
			throw new Error(`Status code: ${res.statusCode}, Status message: ${res.statusMessage}`);
		} 
		return	[
			res.body, 
			res.statusCode
		];
		
	} catch (err) {
		logger.error("jellyRequest: ", err);
	}
};

const jellyfinSystemTasks = async (taskId) => {
	try {
		const taskName = insertSpacesCamel(taskId);
		logger.info(`Run Jellyfin system task: ${taskName}`);
		const [ tasks ] = await jellyRequest('ScheduledTasks');
		for (let key in tasks) {
			if (tasks[key].Key === taskId) {
				if (tasks[key].State === 'Running') {
					logger.info(`Jellyfin task ${taskName} is already running. Current progress: ${tasks[key]. CurrentProgressPercentage}%`);
					return true;
				}
				const [ response, code ] = await jellyRequest(
					`ScheduledTasks/Running/${tasks[key].Id}`, 
					{ method: 'POST' }
				);
				if (code === 204) {
					logger.info(`Jellyfin task ${taskName} triggered with success.`);
					return true;
				}
			} 
		}
		
		return false;
		
	} catch (err) {
		logger.error("jellyfinSystemTasks: ", err);
	}
};

const jellyfinGetParentIds= async () => {
	try {
		logger.info(`Get Jellyfin items parents ids`);
		
		const path = `Users/ca0967efa4b848fa9b0e96ea25e2c177/Items?SortBy=DateCreated&SortOrder=Descending&enableTotalRecordCount=false&enableImages=false`;
		const type = (envs.importArr === 'radarr') ? 'movies' : 'tvshows';
		
		let parentIds = [];
		let [ response, code ] = await jellyRequest(`${path}`);
		if (code === 200 && response.Items) {
			response.Items.forEach(function (obj) {
				//console.log(obj)
				if (obj.CollectionType !== 'ss') {
					parentIds.push(obj.Id)
				}
			});
		}
		console.log(parentIds)
		if (parentIds.length > 0 ) {
			logger.info(`Found ${parentIds.length} parents ids`);
			return parentIds;
		}
		
		logger.warn(`No items parents ids found`);
		return false;
		
	} catch (err) {
		logger.error("jellyfinCheckSync: ", err);
	}
};

const jellyfinCheckSync = async () => {
	try {
		logger.info(`Waiting Jellyfin to discover media`);
		await jellyfinGetParentIds();
		
		////// TODO: 
		//const path = `Users/ca0967efa4b848fa9b0e96ea25e2c177/Items?SortBy=DateCreated&SortOrder=Descending&IncludeItemTypes=Movie&Limit=2&ParentId=7a2175bccb1f1a94152cbd2b2bae8f6d&fields=Path&enableTotalRecordCount=false&enableImages=false`;
		//const path = `Users/ca0967efa4b848fa9b0e96ea25e2c177/Items?SortBy=DateCreated&SortOrder=Descending&IncludeItemTypes=Movie&Limit=2&ParentId=7a2175bccb1f1a94152cbd2b2bae8f6d&fields=Path&enableTotalRecordCount=false&enableImages=false`;
		const path = `Users/ca0967efa4b848fa9b0e96ea25e2c177/Items?SortBy=DateCreated&SortOrder=Descending`;
		/////
		
		let [ response, code ] = await jellyRequest(`${path}`);
		
		let checks = 10;
		for (let i = 0; i < checks; i++) { 
			let [ response, code ] = await jellyRequest(`${path}`);
			//console.log(response);
			if (code === 200 && response.Items.find(obj => obj.Path == envs.movieFilePath)) {
				return true;
			}
			await new Promise(r => setTimeout(r, 10500));
		}
		logger.warn(`Jellyfin discover faild`);
		return false;
		
	} catch (err) {
		logger.error("jellyfinCheckSync: ", err);
	}
};

const runJellyfinTasks = async () => {
	try {
		if (!envs.jellyfinAddress || !envs.jellyfinApiKey) {
			logger.warn(`Jellyfin IP:PORT/API Key not found in .env. Skiping tasks...`)
			return;
		}
		
		if (envs.importArr === 'sonarr') {
			await jellyfinSystemTasks('CPBIntroSkipperDetectIntroductions');
		}
		await jellyfinSystemTasks('RefreshChapterImages');
		await jellyfinCheckSync();
	} catch (err) {
		logger.error("runJellyfinTasks: ", err);
	}
};

module.exports = {
	runJellyfinTasks,
}