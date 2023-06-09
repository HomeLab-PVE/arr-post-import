const fs = require('fs');
const path = require('path');
const languageEncoding = require("detect-file-encoding-and-language");
const iconv = require('iconv-lite');
const { fileExists, capitalize } = require('./../utils');
const { logger } = require('./../logger');

const detectEncoding = async (filePath) => {
	try {
		return await languageEncoding(filePath);
	} catch (err) {
		logger.error("detectEncoding: ", err);
	}
};

const checkForExternalSubs = async (envs) => {
	try {
		let arr = envs.movieFileRelativePath.split(".");
		const extension = arr.pop();
		const movieNameNoExtension = arr.join(".");
		const subRips = ['srt', 'sub'];
		for (let i = 0; i < subRips.length; i++) {
			let filePath = path.join(envs.moviePath, `${movieNameNoExtension}.${subRips[i]}`);
			if (await fileExists(filePath)) {
				logger.info(`Found external sub: ${filePath}`)
				return {
					filePath: filePath,
					moviePath: envs.moviePath,
					fileNameNoExtension: movieNameNoExtension,
					extension: subRips[i],
				};
			}
		}
		logger.info(`No external subs found in ${path.dirname(envs.movieFileRelativePath)}`)
		return false;
	} catch (err) {
		logger.error("checkForExternalSubs: ", err);
	}
};

const infoLanguageEncoding = (data) => {
	if (!data) {
		return;
	}
	info = [];
	info.push(`Detected language and encoding: ${capitalize(data.language)}(confidence:${data.confidence.language})`);
	info.push(`${data.encoding}(confidence:${data.confidence.encoding})`);
	return info;
}

const convertSubtitles = async (filePath, originalEncoding, saveLocation) => {
	try {
		if (!saveLocation) {
			saveLocation = filePath;
		}
		const fileBuffer = await fs.promises.readFile(filePath);
		const fileContent = iconv.decode(fileBuffer, originalEncoding);
		const utf8Buffer = iconv.encode(fileContent, 'utf-8');
		logger.info(`File buffer converted from ${originalEncoding} to UTF-8 encoding`);
		await fs.promises.writeFile(saveLocation, utf8Buffer);
		logger.info(`Subtitle saved successfully in ${saveLocation}`);
		return true;
	} catch (err) {
		logger.error("convertSubtitles: ", err);
	}
}

const convertExternalSubtitles = async (opts = {}) => {
	try {
		const detectedEnconding = await detectEncoding(opts.filePath);
		if (!detectedEnconding) {
			return;
		}
		if (detectedEnconding.language !== 'romanian') {
			logger.info('Detected language is not Romanian. Abort...');
			return;
		}
		logger.info(infoLanguageEncoding(detectedEnconding).join(', '));
		
		let saveLocation = path.join(opts.moviePath, `${opts.fileNameNoExtension}.ro.${opts.extension}`);

		await convertSubtitles(opts.filePath, detectedEnconding.encoding, saveLocation);
		await archiveSub({
			old: opts.filePath,
			new: opts.filePath + '.archive',
		});
		
		return true;
		
	} catch (err) {
		logger.error("convertExternalSubtitles: ", err);
	}
};

const checkExtractedSubtitles = async (extractedSubtitles = []) => {
	try {
		for (let i = 0; i < extractedSubtitles.length; i++) {
			let filePath = extractedSubtitles[i].path;
			logger.info(`Validating the extracted subtitle ${filePath}`);
			let detectedEncondingAndLanguage = await detectEncoding(filePath);
			logger.info(infoLanguageEncoding(detectedEncondingAndLanguage).join(', '));
			let encoding = detectedEncondingAndLanguage.encoding.toLowerCase();
			if (encoding === 'utf-8' && detectedEncondingAndLanguage.language === 'romanian') {
				return;
			} else {
				if (detectedEncondingAndLanguage.language !== 'romanian') {
					await fs.promises.unlink(filePath, {
						force: true,
					});
					logger.info(`Subtitle ${filePath} deleted because detected language is not Romanian.`);
					return;
				}
				if (encoding !== 'utf-8') {
					logger.info(`Subtitle neads to be converted to UTF-8`);
					await convertSubtitles(filePath, detectedEncondingAndLanguage.encoding);
				}
			}
		}
		
		return;
		
	} catch (err) {
		logger.error("checkExtractedSubtitles: ", err);
	}
};

const archiveSub = async ( opts = {} ) => {
	try {
		await fs.rename(opts.old, opts.new, (error) => {
			if (error) {
				logger.error("Archiving external source subtitle: ", err);
				return false;
			}
			logger.info(`Archived external source subtitle in ${opts.new}`);
			return true;
		});
	} catch (err) {
		logger.error("archiveSub: ", err);
	}
}
	
const srtPath = function (language) {
	const languageSuffix = language ? '.' + language : ''
	return path.join(dir, name + languageSuffix + '.srt')
}
		
module.exports = {
	convertExternalSubtitles, 
	detectEncoding, 
	checkForExternalSubs, 
	checkExtractedSubtitles, 
}
