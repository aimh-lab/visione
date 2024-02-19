var regex_to_match_keyframe_number = /_(\d+(?:_\d+)?)(?:-(\d+))?$|-(\d+)$/;
var cells = 49;
var canvasWidth = 275;
var canvasHeight = 154;

CELL_COLS = 7;
CELL_ROWS = 7;

var cellWidth = canvasWidth / CELL_COLS;
var cellHeight = canvasHeight / CELL_ROWS;

var borderColors = ["#63b598", "#ce7d78", "#ea9e70", "#a48a9e", "#c6e1e8", "#648177", "#0d5ac1",
	"#f205e6", "#1c0365", "#14a9ad", "#4ca2f9", "#a4e43f", "#d298e2", "#6119d0",
	"#d2737d", "#c0a43c", "#f2510e", "#651be6", "#79806e", "#61da5e", "#cd2f00",
	"#9348af", "#01ac53", "#c5a4fb", "#996635", "#b11573", "#4bb473", "#75d89e",
	"#2f3f94", "#2f7b99", "#da967d", "#34891f", "#b0d87b", "#ca4751", "#7e50a8",
	"#c4d647", "#e0eeb8", "#11dec1", "#289812", "#566ca0", "#ffdbe1", "#2f1179",
	"#935b6d", "#916988", "#513d98", "#aead3a", "#9e6d71", "#4b5bdc", "#0cd36d",
	"#250662", "#cb5bea", "#228916", "#ac3e1b", "#df514a", "#539397", "#880977",
	"#f697c1", "#ba96ce", "#679c9d", "#c6c42c", "#5d2c52", "#48b41b", "#e1cf3b",
	"#5be4f0", "#57c4d8", "#a4d17a", "#225b8", "#be608b", "#96b00c", "#088baf",
	"#f158bf", "#e145ba", "#ee91e3", "#05d371", "#5426e0", "#4834d0", "#802234",
	"#6749e8", "#0971f0", "#8fb413", "#b2b4f0", "#c3c89d", "#c9a941", "#41d158",
	"#fb21a3", "#51aed9", "#5bb32d", "#807fb", "#21538e", "#89d534", "#d36647",
	"#7fb411", "#0023b8", "#3b8c2a", "#986b53", "#f50422", "#983f7a", "#ea24a3",
	"#79352c", "#521250", "#c79ed2", "#d6dd92", "#e33e52", "#b2be57", "#fa06ec",
	"#1bb699", "#6b2e5f", "#64820f", "#1c271", "#21538e", "#89d534", "#d36647",
	"#7fb411", "#0023b8", "#3b8c2a", "#986b53", "#f50422", "#983f7a", "#ea24a3",
	"#79352c", "#521250", "#c79ed2", "#d6dd92", "#e33e52", "#b2be57", "#fa06ec",
	"#1bb699", "#6b2e5f", "#64820f", "#1c271", "#9cb64a", "#996c48", "#9ab9b7",
	"#06e052", "#e3a481", "#0eb621", "#fc458e", "#b2db15", "#aa226d", "#792ed8",
	"#73872a", "#520d3a", "#cefcb8", "#a5b3d9", "#7d1d85", "#c4fd57", "#f1ae16",
	"#8fe22a", "#ef6e3c", "#243eeb", "#1dc18", "#dd93fd", "#3f8473", "#e7dbce",
	"#421f79", "#7a3d93", "#635f6d", "#93f2d7", "#9b5c2a", "#15b9ee", "#0f5997",
	"#409188", "#911e20", "#1350ce", "#10e5b1", "#fff4d7", "#cb2582", "#ce00be",
	"#32d5d6", "#17232", "#608572", "#c79bc2", "#00f87c", "#77772a", "#6995ba",
	"#fc6b57", "#f07815", "#8fd883", "#060e27", "#96e591", "#21d52e", "#d00043",
	"#b47162", "#1ec227", "#4f0f6f", "#1d1d58", "#947002", "#bde052", "#e08c56",
	"#28fcfd", "#bb09b", "#36486a", "#d02e29", "#1ae6db", "#3e464c", "#a84a8f",
	"#911e7e", "#3f16d9", "#0f525f", "#ac7c0a", "#b4c086", "#c9d730", "#30cc49",
	"#3d6751", "#fb4c03", "#640fc1", "#62c03e", "#d3493a", "#88aa0b", "#406df9",
	"#615af0", "#4be47", "#2a3434", "#4a543f", "#79bca0", "#a8b8d4", "#00efd4",
	"#7ad236", "#7260d8", "#1deaa7", "#06f43a", "#823c59", "#e3d94c", "#dc1c06",
	"#f53b2a", "#b46238", "#2dfff6", "#a82b89", "#1a8011", "#436a9f", "#1a806a",
	"#4cf09d", "#c188a2", "#67eb4b", "#b308d3", "#fc7e41", "#af3101", "#ff065",
	"#71b1f4", "#a2f8a5", "#e23dd0", "#d3486d", "#00f7f9", "#474893", "#3cec35",
	"#1c65cb", "#5d1d0c", "#2d7d2a", "#ff3420", "#5cdd87", "#a259a4", "#e4ac44",
	"#1bede6", "#8798a4", "#d7790f", "#b2c24f", "#de73c2", "#d70a9c", "#25b67",
	"#88e9b8", "#c2b0e2", "#86e98f", "#ae90e2", "#1a806b", "#436a9e", "#0ec0ff",
	"#f812b3", "#b17fc9", "#8d6c2f", "#d3277a", "#2ca1ae", "#9685eb", "#8a96c6",
	"#dba2e6", "#76fc1b", "#608fa4", "#20f6ba", "#07d7f6", "#dce77a", "#77ecca"];

var colorMap = {
	'white': 'style="background-color: white; color: rgb(0,0,0);  border: 1px solid #000;"',
	'black': 'style="background-color: black; color: rgb(255,255,255);"',
	'blue': 'style="background-color: blue; color: rgb(255,255,255);"',
	'brown': 'style="background-color: brown; color: rgb(255,255,255);"',
	'green': 'style="background-color: green; color: rgb(255,255,255);"',
	'grey': 'style="background-color: grey; color: rgb(255,255,255);"',
	'orange': 'style="background-color: orange; color: rgb(255,255,255);"',
	'pink': 'style="background-color: pink; color: rgb(255,255,255);"',
	'purple': 'style="background-color: purple; color: rgb(255,255,255);"',
	'red': 'style="background-color: red; color: rgb(255,255,255);"',
	'yellow': 'style="background-color: yellow; color: rgb(0,0,0);"'
};

var availableTags = null;

var rect, origX, origY, textVal, activeObj, overObj;
var prevQuery = [];

var isDrawing = false;
var draggedLabel = '';
var isDragging = false;
var prevTextual = [];
var prevCLIP = [];
var prevNotField = [];
var prevCanvasObjects = [];
var isCanvasClean = [];
var isReset = false;


var canvases;
var prevIs43 = false;
var prevIs169 = false;
var prevIsColor = [];
var prevIsGray = [];

var results = null;
var resultsSortedByVideo = null;
var res = null
var isGray = [];
var isColor = [];
var occur = ['and', 'and'];
var textualMode = ["all", "all"];
var simreorder = false;

//var qbeUrl = ''
var is43 = false;
var is169 = false;

var urlVBSService = '';
var translateService = '';
var thumbnailUrl = '';
var keyFramesUrl = '';
var activeCanvasIdx = 0;
var activeCanvas = "";
var isCanvasEnabled = [true, true];
var prevIsCanvasEnabled = [];
var prevSimreorder = false;
var prevOccur = ['and', 'and'];
var prevTextualMode = ["clip", "clip"];

var prevQBE = "";

var tempSearchForms = 2
var latestQuery = "";
var setDisplayTo = "block";
var isAdvanced = false
var resCursor = 0;
var resMatrix = [];
var colIdx = 1;
var rowIdx = 0;
//var isAVS = false;
//var isQA = false;

var config = null;
var loadingSpinner = null;
var numResultsPerVideo = 10;
var defaultLanguage = "auto";
var defaultTaskType = "kis";
var framesCache = [];
var collectionName;


function handler(myObj) {
	urlVBSService = myObj.serviceUrl;
	speech2TextService = myObj.speech2Text;
	translateService = myObj.translate;

	thumbnailUrl = myObj.thumbnailUrl;
	keyFramesUrl = myObj.keyFramesUrl;
	videoUrlPrefix = myObj.videoUrl;
	videoshrinkUrl = myObj.videoshrinkUrl;

	//document.cookie = 'isQA=' + isQA + '; path=/';

	//localStorage.setItem('isQA', isQA);
}

/*
function setAVS(isAvsSel) {
	isAVS = isAvsSel;
	isQA = false;
	localStorage.setItem('isQA', isQA);
	//document.cookie = 'isQA=' + isQA + '; path=/';

}

function setQA(isQASel) {
	isQA = isQASel;
	isAVS = false;
	localStorage.setItem('isQA', isQA);
	//document.cookie = 'isQA=' + isQA + '; path=/';

}*/

function loadConfig() {
	promise1 = fetch("config.yaml").then(response => response.text()).then(data => { config = jsyaml.load(data); });
	promise2 = fetch("js/conf.json").then(response => response.json()).then(handler);
	return Promise.all([promise1, promise2]);
}

function setSpeech(speechRes, idx) {
	if (speechRes == null) {
		console.log("Warning, speechRes is " + speechRes);
		prevTextual[idx] = $("#textual" + idx).val();
		//$("#textual" + idx).val('');
		//document.getElementById('cancelText' + idx).style.display = 'none'
		//searchByForm();
	}

	else {
		console.log(speechRes);
		let jsonSpeech = JSON.parse(speechRes)

		$("#textual" + idx).val(jsonSpeech.translation);
		document.getElementById('cancelText' + idx).style.display = 'block'

		//searchByForm();
	}
	searchByForm();
}

function setTranslate(speechRes, idx) {
	if (speechRes == null) {
		console.log("Warning, speechRes is " + speechRes);
		prevTextual[idx] = $("#textual" + idx).val();
		//$("#textual" + idx).val('');
		//document.getElementById('cancelText' + idx).style.display = 'none'
		//searchByForm();
	}

	else {
		console.log(speechRes);
		let jsonTranslate = JSON.parse(speechRes)

		if (jsonTranslate.is_translated == "True") {
			$("#textual" + idx).val(jsonTranslate.translated_text);
			document.getElementById('cancelText' + idx).style.display = 'block'

			let toLog = {
				"query": [],
				"parameters": []
			};
			toLog.query.push({"translate": ""});
			//to fix a boolean parse error
			//toLog.parameters.push({"detected_language":jsonTranslate.detected_language,"original_text":jsonTranslate.original_text,"translated_text":jsonTranslate.translated_text,"translation_model":jsonTranslate.translation_model})
			toLog.parameters.push(jsonTranslate);
			toLog = JSON.stringify(toLog);
			console.log(toLog);
			log(toLog);
		}

		//searchByForm();
	}
	searchByForm();
}

function playVideo(id) {
	alert(id);
	alert(getStartTime(id + ".jpg"));
}

function split(val) {
	return val.split(" ");
}

function extractLast(term) {
	return split(term).pop();
}

function extractprev(term) {
	return split(term).pop();
}

$.get('objects_doc_freq.csv', function (data) {
	availableTags = data.split("\n");
	//availableTags = [];
});

draggedLabel = '';

function drag(ev) {
	ev.dataTransfer.setData("text", ev.target.id);
	draggedLabel = ev.target.title;
}

function getText(id, field) {
	return $
		.ajax({
			type: "GET",
			url: urlVBSService + "/getText?id=" + id + "&field=" + field,
			async: false
		}).responseText
}

function getAllVideoKeyframes(videoId) {
	return $
		.ajax({
			type: "GET",
			url: urlVBSService + "/getAllVideoKeyframes?videoId=" + videoId,
			async: false
		}).responseText
}

function getField(id, field) {
	return $
		.ajax({
			type: "GET",
			url: urlVBSService + "/getField?id=" + id + "&field=" + field,
			async: false
		}).responseText
}

function getStartTime(id) {
	return $
		.ajax({
			type: "GET",
			url: urlVBSService + "/getStartTime?id=" + id,
			async: false
		}).responseText
}

function getEndTime(id) {
	return $
		.ajax({
			type: "GET",
			url: urlVBSService + "/getEndTime?id=" + id,
			async: false
		}).responseText
}

function getMiddleTimestamp(id) {
	return $
		.ajax({
			type: "GET",
			url: urlVBSService + "/getMiddleTimestamp?id=" + id,
			async: false
		}).responseText
}

/*
function submitWithAlert(id, videoId) {
	if (!isAVS) {
		if (confirm('Are you sure you want to submit?')) {
			res = submitResult(id, videoId);
			console.log(res);
			alert('Server response: ' + res);
		}
	} else {
		res = submitResult(id, videoId);
	}
}

function submitWithAlert2(selectedItem, isConfirm) {
	if (isConfirm) {
		if (confirm('Are you sure you want to submit?')) {
			res = submitResult(selectedItem.imageId, selectedItem.videoId);
			console.log(res);
			alert('Server response: ' + res);
		}
	} else {
		res = submitResult(selectedItem.imageId, selectedItem.videoId);
		console.log(res);
	}
	avsSubmitted.set(selectedItem.videoId, selectedItem);
	avsSubmittedTab(selectedItem);
}
*/

//to remove
function startNewSession() {
	if (confirm('Are you sure you want to start a new session?')) {
		location.reload();
		$.ajax({
			type: "GET",
			async: false,
			url: urlVBSService + "/init"
		}).responseText
	}
}

function startNewKISSession() {
	//if (confirm('Starting a new KIS session?')) {
	location.href = "index_V3C.html";
	$.ajax({
		type: "GET",
		async: false,
		url: urlVBSService + "/init"
	}).responseText
	//}
}

function startNewAVSSession() {
	//if (confirm('Starting a new AVS session?')) {
	location.href = "index_V3C_AVS.html";
	$.ajax({
		type: "GET",
		async: false,
		url: urlVBSService + "/init"
	}).responseText
	loadConfig();
	//}
}


/*function log(query) {
	return $.ajax({
		type: "GET",
		async: false,
		url: urlVBSService + "/log?query=" + query,
	}).responseText;
}*/

function log(query) {
	$.ajax({
		type: "POST",
		async: true,
		crossDomain: false,
		data: { query: query },
		dataType: "text",
		url: urlVBSService + "/log",
		success: function (data) {
			console.log(data)
		},
		error: function (data) {
			console.log("Error logging " + data)
		}
	})
}

function addDeleteBtn(label, rect) {
	var id = rect.get('uuid');

	var x = rect.aCoords.tr.x;
	var y = rect.aCoords.tr.y;
	var left = rect.left;

	if (rect.group) {
		var point = rect.getCenterPoint();
		x = rect.group.left;
		y = rect.group.top;
		left = rect.group.left;
	}

	var btnLeft = x - 7;
	var btnTop = y - 5;
	var labelLeft = rect.left;
	var labelTop = y - 22;

	var deleteBtn = '<div id="'
		+ id
		+ '" title="'
		+ label
		+ '"><span style="color: DarkSlateGray; font-size: 1.3em; position:absolute;top:'
		+ labelTop
		+ 'px;left:'
		+ labelLeft
		+ 'px;">'
		+ label
		+ '</span><img id="'
		+ id
		+ '" src="img/Actions-dialog-close-icon.png" class="deleteBtn" style="position:absolute;top:'
		+ btnTop + 'px;left:' + btnLeft
		+ 'px;cursor:pointer;width:16px;height:16px;"/></div>';
	$(".canvas-container").eq(activeCanvasIdx).append(deleteBtn);
}


function cell2Text(idx) {
	let queryObj = new Object();
	let queryParameters = {};

	let textual = '';
	element = $("#textual" + idx);
	if (element.length > 0) {
		textual = element.val().trim().replace(/[^\x21-\x7E]+/g, ' ');
	}

	if (textual != '') {
		queryObj.textual = textual;
		queryParameters['textualMode'] = textualMode[idx];
	}

	if (isCanvasEnabled[idx]) {
		//is43 = $("#is43").is(":checked");
		//is169 = $("#is169").is(":checked");
		isColor[idx] = $("#isColor" + idx).is(":checked");
		isGray[idx] = $("#isGray" + idx).is(":checked");
		//occur = $('input[name="occur' + idx + '"]:checked').val();
		//simreorder = $("#simreorder").is(":checked");

		let objects = '';
		let txt = '';
		let query = '';
		let colors = [];

		canvases[idx].getObjects().forEach(
			function (o) {
				if (o.get('type') == 'rect') {
					if (o && o.oCoords) {
						var startCol = Math.floor(Math.max(0, o.oCoords.tl.x) / cellWidth);
						var endCol = Math.ceil(Math.min(canvasWidth, o.oCoords.tr.x) / cellWidth); resultsSortedByVideo = [];
						var startRow = Math.floor(Math.max(0, o.oCoords.tr.y) / cellHeight);
						var endRow = Math.ceil(Math.min(canvasHeight, o.oCoords.br.y) / cellHeight);
					} else {
						var startCol = Math.floor(Math.max(0, o.left) / cellWidth);
						var endCol = Math.ceil(Math.min(canvasWidth, (o.left + o.width)) / cellWidth);

						var startRow = Math.floor(Math.max(0, o.top) / cellHeight);
						var endRow = Math.ceil(Math.min(canvasHeight, (o.top + o.height)) / cellHeight);
					}
					let label = $("#" + o.uuid).attr('title').trim();

					if (o.uuid.startsWith('color_')) {
						colors.push(label);
					} else {
						objects += label + " ";
					}

					for (let row = startRow; row < endRow; row++) {
						for (let col = startCol; col < endCol; col++) {
							// txt += col + String.fromCharCode(97 + row) +
							// label + '%5E' + boost + ' ' ;
							txt += row + String.fromCharCode(97 + col) + label
								+ ' ';
						}
					}
				}
			})
		for (let cIdx = 0; cIdx < colors.length; cIdx++) {
			objects += colors[cIdx] + " ";
		}

		if (isGray[idx]) {
			objects += "graykeyframe ";
		} else if (isColor[idx]) {
			objects += "colorkeyframe ";
		}

		if (is43) {
			objects += "ratio43 ";
		} else if (is169) {
			objects += "ratio169 ";
		}

		//textualMode = $("#textualmode" + idx).val().trim().replace(/[^\x21-\x7E]+/g, ' ');
		//clip = $("#clip" + idx).val().trim().replace(/[^\x21-\x7E]+/g, ' ');
		//let notField = $("#not" + idx).val().trim().replace(/[^\x21-\x7E]+/g, ' ');

		let notField = '';
		let element = $("#not" + idx);
		if (element.length > 0) {
			notField = element.val().trim().replace(/[^\x21-\x7E]+/g, ' ');
		}

		//let textual = $("#textual" + idx).val().trim().replace(/[^\x21-\x7E]+/g, ' ');

		if (notField != '') {
			let items = notField.split(" ");
			let parsedField = '';
			for (let i = 0; i < items.length; i++) {
				if (!isNaN(items[i])) {
					let freq = Math.max((+items[i] + 1), 0);
					i++;
					parsedField += items[i] + freq + " ";
				} else
					parsedField += items[i] + " ";
			}
			notField = parsedField.trim();
			notField = ' -' + notField.replace(new RegExp(" ", "g"), ' -');
		}

		if (objects != '') {
			groups = '';
			if ((group = objects.match('\\((.*?)\\)'))) {
				objects = objects.replace("\\(" + group[1] + "\\)", '');
				groups += group;
			}
		} else if (notField != '')
			objects = "*";

		objects += notField;

		if (objects != '' && isAdvanced)
			queryObj.objects = objects.trim();

		//	if (clip != '')
		//		queryObj.clip = clip;

		if (txt != '' && isAdvanced)
			queryObj.txt = txt.trim();
		if (Object.keys(queryObj).length > 0 && isAdvanced) {
			queryParameters['occur'] = occur[idx];
			queryParameters['simReorder'] = simreorder.toString();
		}
	}

	if (Object.keys(queryObj).length === 0)
		return null;
	return [queryObj, queryParameters];
}

function timestamp() {
	let time = Math.floor(new Date() / 1000);
	console.log(" DATE " + time);
	return;
}

function searchByLink(queryID) {
	//prevQuery = query;
	if (queryID != null) {
		let jsonString = JSON.stringify(queryID);
		jsonString = '{"query":[' + jsonString + '], "parameters":[{"simReorder":"' + simreorder.toString() + '"}]}';
		//		'{"query":' + jsonStringQuery + ', "parameters":' + jsonStringParameters +'}';
		//queryID = '{"query":[' + queryID + ']}';
		search2(jsonString);
	}
	else
		$("#imgGridResults").remove();
}

function searchByForm() {
	let queriesArr = []
	let parameteresArr = []
	let jsonString = ""

	for (let cellIndex = 0; cellIndex < tempSearchForms; cellIndex++) {
		cellQuery = cell2Text(cellIndex);
		if (cellQuery != null) {
			queriesArr.push(cellQuery[0])
			parameteresArr.push(cellQuery[1])
		}
	}
	prevQuery = queriesArr;
	if (queriesArr.length > 0) {
		let jsonStringQuery = JSON.stringify(queriesArr);
		let jsonStringParameters = JSON.stringify(parameteresArr);
		jsonString = '{"query":' + jsonStringQuery + ', "parameters":' + jsonStringParameters + '}';
	}
	search2(jsonString);
}

function setResults(data) {
	//data ='[{"score":13.926777,"videoId":"05188","imgId":"05188_12","middleFrame":919,"collection":"v3c"},{"score":13.917663,"videoId":"17058","imgId":"17058_85","middleFrame":5345,"collection":"v3c"}]'

	results = data;
	//results = sortByVideo(data);
	resultsSortedByVideo = results;
	groupResults(document.getElementById("group"));
	// history.pushState(JSON.stringify($(this)),'List',window.location.href);
}

function search2(query) {
	res = null;
	try {
		loadingSpinner = document.getElementById('loading-spinner');

		loadingSpinner.style.display = 'block';
		latestQuery = query
		if (query == "") {
			setResults(query)
		} else {
			console.log(query);

			$.ajax({
				type: "POST",
				async: true,
				data: { query: query, simreorder: simreorder, n_frames_per_row: numResultsPerVideo },
				dataType: "text",
				url: urlVBSService + "/search",
				success: function (data) {
					setResults(data)
				},
				error: function (data) {
					setResults(data);
				}
			});
		}
	} catch(err) {
		loadingSpinner.style.display = 'none';
	}
}

function searchByALADINSimilarity(query) {
	$.ajax({
		type: "POST",
		data: { query: query },
		dataType: "text",
		url: urlVBSService + "/search",
		success: function (data) {
			results = data;
			//results = sortByVideo(data);
			resultsSortedByVideo = results;
			groupResults(document.getElementById("group"));
			// history.pushState(JSON.stringify($(this)),'List',window.location.href);
		},
		error: function (data) {
			$("#imgGridResults").remove();
		}
	});
}

function searchByCLIPSimilarity(query) {
	$.ajax({
		type: "POST",
		data: { query: query },
		dataType: "text",
		url: urlVBSService + "/search",
		success: function (data) {
			results = data;
			//results = sortByVideo(data);
			resultsSortedByVideo = results;
			groupResults(document.getElementById("group"));
			// history.pushState(JSON.stringify($(this)),'List',window.location.href);
		},
		error: function (data) {
			$("#imgGridResults").remove();
		}
	});
}

function sortByVideo(data) {
	resultsSortedByVideo = [];
	if (data != null && data.trim() != "") {
		let res = JSON.parse(data);

		console.log("Sort By Video " + res.length);
		if (res.length != 0) {
			let dataDict = {};

			let keys = [];

			for (i = 0; i < res.length; i++) {
				let imgId = res[i].imgId;
				let videoId = res[i].videoId;
				let score = res[i].score;

				let value = dataDict[videoId];
				if (value == null) {
					value = [];
					keys[keys.length] = videoId;
				}
				value.push(res[i]);
				// console.log(res[i] + ' ' + res[i + 1] + ' ');
				dataDict[videoId] = value;
			}
			// console.log(keys);
			for (i = 0; i < keys.length; i++) {
				// console.log(i + " " + dataDict[keys[i]]);
				let resPerVideo = dataDict[keys[i]];
				for (j = 0; j < resPerVideo.length; j++) {
					resultsSortedByVideo.push(resPerVideo[j]);
				}
			}
		}
	}
	resultsSortedByVideo = JSON.stringify(resultsSortedByVideo);

	return resultsSortedByVideo;
}

function groupResults(checkbox) {
	/*if(checkBox = document.getElementById("group").checked) {
		showResults(resultsSortedByVideo);
	}
	else {
		showResults(results);
	}*/
	showResults(resultsSortedByVideo);
}

function setGray(checkboxId) {
	if (checkBox = document.getElementById("isGray" + checkboxId).checked) {
		isGray[checkboxId] = true;
		document.getElementById("isColor" + checkboxId).checked = false;
		isColor[checkboxId] = false;
	}
	else
		isGray[checkboxId] = false;
	searchByForm();
}

function setOccur(radioButton, canvasId) {
	occur[canvasId] = $('input[name="occur' + canvasId + '"]:checked').val();
	console.log(occur);

	searchByForm();
}
/*
function setTextualMode(checkboxId, mode) {
	if (textualMode[checkboxId].includes(mode))
		textualMode[checkboxId] = textualMode[checkboxId].replace(mode, "")
	else
		textualMode[checkboxId] += mode;
	searchByForm();
}*/

function setTextualMode(checkboxId, mode) {
	textualMode[checkboxId] = mode;
	tmp = $("#textual" + checkboxId);
	textQuery = $("#textual" + checkboxId).val();
	if (textQuery.length > 0) {
		if (document.getElementById("isTranslate" + checkboxId).checked)
			translateText(textQuery, 0);
		searchByForm();
	}
}
/*
function setTextualMode(checkboxId) {
	if(checkBox = document.getElementById("textualMode" + checkboxId).checked) {
		textualMode[checkboxId] = "aladin";
	}
	else
		textualMode[checkboxId] = "clip";
	searchByForm();
}
*/
function enableCanvas(canvasId, storePrev) {
	document.getElementById("overlay" + canvasId).style.display = "none";
	$('input:radio[name=canvas' + canvasId + ']')[0].checked = true;
	if (storePrev)
		prevIsCanvasEnabled[canvasId] = isCanvasEnabled[canvasId];
	isCanvasEnabled[canvasId] = true

}

function disableCanvas(canvasId, storePrev) {
	document.getElementById("overlay" + canvasId).style.display = "block";
	$('input:radio[name=canvas' + canvasId + ']')[1].checked = true;

	if (storePrev)
		prevIsCanvasEnabled[canvasId] = isCanvasEnabled[canvasId];
	isCanvasEnabled[canvasId] = false

}

function resetCanvas() {
	enableCanvas(0, true);
	enableCanvas(1, true); +
		searchByForm();

}

function undoCanvas() {
	//canvas0State = $('input[name="canvas0"]:checked').val();
	//canvas1State = $('input[name="canvas1"]:checked').val();
	if (prevIsCanvasEnabled[0]) {
		enableCanvas(0, true);
	} else {
		disableCanvas(0, true);
	}

	if (prevIsCanvasEnabled[1]) {
		enableCanvas(1, true);
	} else {
		disableCanvas(1, true);
	}
	searchByForm();
}

function setCanvasState(canvasId) {
	let canvas0State = $('input[name="canvas0"]:checked').val();
	let canvas1State = $('input[name="canvas1"]:checked').val();
	if (canvas0State == "enabled") {
		enableCanvas(0, true);
	} else {
		disableCanvas(0, true);
	}

	if (canvas1State == "enabled") {
		enableCanvas(1, true);
	} else {
		disableCanvas(1, true);
	}
	searchByForm();
}


function setSimReorder(checkbox) {
	if (checkBox = document.getElementById("simreorder").checked)
		simreorder = true;
	else
		simreorder = false;
}

function setColor(checkboxId) {
	if (checkBox = document.getElementById("isColor" + checkboxId).checked) {
		isColor[checkboxId] = true;
		document.getElementById("isGray" + checkboxId).checked = false;
		isGray[checkboxId] = false;

	}
	else
		isColor[checkboxId] = false;
	searchByForm();
}

function set43(checkbox) {
	if (checkBox = document.getElementById("is43").checked) {
		is43 = true;
		document.getElementById("is169").checked = false;
		is169 = false;
	}
	else
		is43 = false;
	searchByForm();
}

function set169(checkbox) {
	if (checkBox = document.getElementById("is169").checked) {
		is169 = true;
		document.getElementById("is43").checked = false;
		is43 = false;
	}
	else
		is169 = false;
	query = []
	for (i = 0; i < tempSearchForms; i++) {
		if (cell2Text(i) != null)
			query.push(cell2Text(i));
	}
	(query);
}

function queryByExample(imgUrl) {
	let queryObj = new Object();
	queryObj.qbe = imgUrl;
	searchByLink(queryObj);
}

function queryByTextual() {
	searchByForm();
}

function queryByCLIP() {
	searchByForm();
}

function fromIDtoColor(id, numberborderColors) { // FRANCA
	let borderColorsIdx = id.hashCode() % numberborderColors;
	return borderColorsIdx;
}

String.prototype.hashCode = function () {// FRANCA
	let hash = 0;
	if (this.length == 0) return hash;
	for (let j = 0; j < this.length; j++) {
		let char = this.charCodeAt(j);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash;
	}
	return hash;
}

function displaySimplifiedUI() {
	document.getElementById('sceneDes1').style.display = 'block';
	document.getElementById('simplified1').style.display = 'block';
	document.getElementById("simplified0").className = 'simplified0'
	document.getElementById("visionelogo").className = 'visioneLogo'
	document.getElementById("visionelogoImg").className = 'visionelogoImg'
	//document.getElementById("sceneDes0").className = 'fa fa-hourglass-start fa-2x'
	//document.getElementById('simplified0').appendChild(document.getElementById('textualOptions0'));
	//document.getElementById('simplified1').appendChild(document.getElementById('textualOptions1'));
}

function showResults(data) {
	try {
		//to avoid textual boxes overlap. Why???
		displayAdvanced(true);
		//temporary!!!!!!!!!!!
		avsCleanManuallySelected();

		/*if ($('meta[name=task]').attr('content') == "AVS") {
			avsCleanManuallySelected();
			avsRemoveAutoselected();
		}*/
		//empty avsFirstCol
		//avsAutoSelected.length = 0
		$('html,body').scrollTop(0);
		$("#imgGridResults").empty();
		//$('#results').scrollTop(0);
		$('#content').scrollTop(0);
		resMatrix = [];
		colIdx = 1;
		rowIdx = -1;
		visibleImages = 0
		framesCache = []

		if ((data == null || data == "") && latestQuery != "") {
			noResultsOutput();
		} else if (data != null && data != "") {
			if (!isAdvanced)
				displaySimplifiedUI();
			try {
				res = JSON.parse(data);
				if (res.length == 0)
					noResultsOutput();
				else {
					noResultsOutput(false);
					//document.getElementById('newsession').style.display = 'block';
					resColIdx = 1;
					resrowIdx = 0;
					visibleImages = 0;
					loadImages(0, batchSize);
				}
			} catch (e){
				console.log(e);
				noResultsOutput();

			}

		}
		//if ($('meta[name=task]').attr('content') == "AVS") {
		if (localStorage.getItem('taskType') === 'avs')
			avsHideSubmittedVideos();
		else
			avsHilightlighSubmittedVideos();
		//avsReloadManuallySelected();
		//avsAddAutoselected();
		//}
		updateAVSInfo();
		//repetita iuvant!!
	}   finally {
		loadingSpinner.style.display = 'none';
	  }

}

var batchSize = 80;
var visibleImages = 0;
var resColIdx = 1;
var resrowIdx = 0;

function loadImages(startIndex, endIndex) {
	let prevID = '';

	if (resrowIdx == 0)
		resMatrix[resrowIdx] = [];
	let img_loading = "eager"
	//patch to avoid same video on two rows

	var extendedBatch = Math.min(endIndex + numResultsPerVideo -1, res.length);
	//patch to align same video on more rows
	let newLine = 0;
	for (var i = startIndex; i < extendedBatch; i++) {
		var imgGridResults = ""
		let imgId = res[i].imgId;
		let videoId = res[i].videoId;

		let score = res[i].score;

		let path = videoId + "/" + imgId;

		let result = imgId.match(regex_to_match_keyframe_number);
		let frameNumber = result ? result[1] || result[2] || result[3] : null;


		if (i > 0 && videoId != prevID) {
			//patch to avoid same video on two rows
			if (i > endIndex )
				break;
			resMatrix[++resrowIdx] = [];
			let spanVal = 11 - resColIdx + newLine;
			newLine = 0;
			resColIdx = 1;
			if (spanVal > 0)
				imgGridResults += '<div data-videoid="' + prevID + '" class="contentGrid-item column-span-' + spanVal + '"></div>';
			imgGridResults += '<div data-videoid="' + prevID + '" class="hline column-span-11"></div>';
		}

		let keyframePath = keyFramesUrl + path + ".png";

		if (videoId != prevID) {
			//imgGridResults += '<div id="video_' + videoId + '">';
			imgGridResults += '<div data-videoid="' + videoId + '" class="item column-span-1"><a href="showVideoKeyframes.html?videoId=' + videoId + '&id=' + imgId + '" target="_blank">' + videoId + '<a></div>';
			var preloadedImage = new Image();
			preloadedImage.src = keyframePath;
		  	framesCache[resrowIdx] = preloadedImage

		}
		let borderColorsIdx = fromIDtoColor(videoId, borderColors.length);
		prevID = videoId;
		let videoUrl = videoUrlPrefix + videoId + "-medium.mp4";
		videoUrlPreview = videoshrinkUrl + videoId + "-tiny.mp4";
		let thumbnailPath = thumbnailUrl + path + ".jpg";
		keyframePath = keyFramesUrl + path + ".png";
		//avsObj = getAvsObj(videoId, imgId, 'avs_' + imgId, thumbnailPath, keyframePath, resrowIdx, resColIdx - 1)
		resultData = getResultData(videoId, imgId, thumbnailPath, imgId, frameNumber, keyframePath, score, videoUrl, videoUrlPreview, resrowIdx, resColIdx - 1)

		if (resColIdx > 0 && (resColIdx+newLine) % 11 == 0) {
			imgGridResults += '<div class="item column-span-1"></div>';
			newLine = 1;
		}

		imgGridResults += '<div data-videoid="' + videoId + '" id="res_' + imgId + '" data-row="' + resrowIdx + '" data-col="' + (resColIdx - 1) + '" class="item column-span-1">'
		//imgGridResults += imgResult(resultData, borderColors[borderColorsIdx], JSON.stringify(avsObj), isAdvanced, img_loading)
		imgGridResults += imgResult(resultData, borderColors[borderColorsIdx], img_loading)
		imgGridResults += '</div>'
		resMatrix[resrowIdx][resColIdx - 1] = res[i];

		resColIdx++;
		$("#imgGridResults").append(imgGridResults);
		visibleImages++;
	}

	resultsVisualization();

	for (var i = startIndex; i < visibleImages; i++) {
		let imgId = res[i].imgId;
		let score = res[i].score;

		let cip = $('#' + imgId).hover(hoverVideo, hideVideo);

		function hoverVideo(e) {
			id4Regex = this.id.replaceAll("/", "\\/").replaceAll(".", "\\.")
			$('#' + id4Regex).contextmenu(function () {
				imgId = 'img' + id4Regex;
				langInfo = this.lang.split('|');
				videoId = langInfo[0];
				videourl = langInfo[1];
				playerId = 'video' + videoId;

				var elementExists = document.getElementById(playerId);

				//var startTime = getStartTime(this.id);
				//var endTime = getEndTime(this.id);
				var middleTime = getMiddleTimestamp(this.id);
				var startTime = middleTime - 2;
				var endTime = middleTime + 2;
				if (elementExists != null) {
					var player = $('#' + playerId).get(0);
					player.pause();
					player.src = videourl + '#t=' + startTime + ',' + endTime;
					player.load();
					player.play();
					return;
				}
				backgroundImg = "background-image: url('" + thumbnailUrl + '/' + this.id + "')";

				//imgGridResults = '<div class="video"><video style="' + backgroundImg + '" id="' + playerId + '" title="'+ this.alt+ '" class="myimg-thumbnail" loop preload="none"><source src="' + this.title + '" type="video/mp4"></video></div>'
				//imgGridResults = '<video style="' + backgroundImg + '" id="' + playerId + '" title="'  + this.title + '" class="myimg video" loop muted preload="none"><source src="' + videourl + '" type="video/mp4"></video>'
				//imgGridResults = '<video style="' + backgroundImg + '" id="' + playerId + '" class="myimg video" loop muted preload="none"><source src="' + videourl + '" type="video/mp4"></video>'
				imgGridResults = '<video id="' + playerId + '" class="myimg video" autoplay loop muted preload="none"><source src="' + videourl + '#t=' + startTime + ',' + endTime + '" type="video/mp4"></video>'
				$('#' + imgId).css("display", "none");
				$('#' + id4Regex).append(imgGridResults);
				//$('#'+ playerId).get(0).currentTime = time-1;
				//$('#'+ playerId).get(0).play();
				return false;
			});

		}

		function hideVideo(e) {
			id4Regex = this.id.replaceAll("/", "\\/").replaceAll(".", "\\.")

			imgId = 'img' + id4Regex;
			langInfo = this.lang.split('|');
			videoId = langInfo[0];
			videourl = langInfo[1];
			playerId = 'video' + videoId;

			var elementExists = document.getElementById(playerId);
			if (elementExists != null) {
				$('#' + playerId).remove();
				$('#' + imgId).css("display", "block");
			}
		}
	}
}


function getResultData(videoId, imgId, thumb, frameName, frameNumber, keyframePath, score, videoUrl, videoUrlPreview, rowIdx, colIdx) {
	let resultData = new Object();
	resultData.videoId = videoId;
	resultData.imgId = imgId;
	resultData.thumb = thumb;
	resultData.frameName = frameName;
	resultData.frameNumber = frameNumber;
	resultData.keyframe = keyframePath;

	resultData.score = score;
	resultData.videoUrl = videoUrl;
	resultData.videoUrlPreview = videoUrlPreview;
	resultData.rowIdx = rowIdx;
	resultData.colIdx = colIdx;
	return resultData
}

function submitQA() {
	let answ = prompt("Please enter your answering", "");
  	if (answ != null) {
		submitResult(id=null, videoId=null, textAnswer=answ, isAsync=true)
		try {
			qaSubmittedTab(answ);
		} catch (e) {
			console.log(e);
		}
	}
}

function submitAlert() {
	if (localStorage.getItem('taskType') != 'avs') {
		if (!confirm('Are you sure you want to submit?')) {
			return false;
		}
	}
	return true;
}

function getTaskType() {
	return localStorage.getItem('taskType');
}

function setTaskType(taskType) {
	if (taskType == null)
		sessionStorage.setItem('taskType', defaultTaskType);
	else
		sessionStorage.setItem('taskType', taskType);

	localStorage.setItem('taskType', sessionStorage.getItem('taskType'));
	$('input[name="option"][value="' + getTaskType() + '"]').prop('checked', true);
	$('#taskTypeLabel').text(getTaskType().toUpperCase() );

}

function submitResult(id, videoId, textAnswer=null, isAsync=false) {
	return $.ajax({
		type: "GET",
		async: isAsync,
		url: urlVBSService + "/submitResult?id=" + id + "&videoid=" + videoId + "&textAnswer=" + textAnswer + "&taskType=" + getTaskType(),
	}).responseText;
}

function submitAtTime(videoId, time) {
	return $.ajax({
		type: "GET",
		async: false,
		url: urlVBSService + "/submitResult?videoid=" + videoId + "&time=" + time  + "&taskType=" + getTaskType(),
	}).responseText;
}

function submitVersion2(selectedItem) {
	$('#submitted_bar').css("display", "block");
	let res = null;
	if (localStorage.getItem('taskType') === 'qa') {
		submitQA();
	} else {
		if (submitAlert()) {
			if (localStorage.getItem('taskType') === 'avs')
				submitResult(selectedItem.imgId, selectedItem.videoId, isAsync=true);
			else {
				res = submitResult(selectedItem.imgId, selectedItem.videoId);
				alert('Server response: ' + res);
			}


			//remove selected image preview
			unselectImg(selectedItem);
			//avsRemoveSelected(selectedItem)

			//updateAVSTab(selectedItem)

			avsSubmitted.set(selectedItem.videoId, selectedItem);

			//add submitted image to the sidebar on the right
			avsSubmittedTab(selectedItem);
			$( "#submitted_num" ).text(avsSubmitted.size)

			//che fa? boh!
			updateAVSInfo();
			if (localStorage.getItem('taskType') === 'avs')
				avsHideSubmittedVideos();
			else
				avsHilightlighSubmittedVideos();
		}
	}
	return res;
}
/*
function unifiedSubmit(avsObj, ev) {
	if (isQA) {
		submitQA();
		return;
	}
	if (!submitAlert())
		return false;

	currentSelected = null;

	//if (avsManuallyByVideoID.size > 0 && !avsManuallyByVideoID.has(avsObj.videoId)) {
		//currentSelected = avsManuallyByVideoID.entries().next().value[1];
		//let manuallySelectedToRemove = avsManuallyByVideoID.get(selectedItem.videoId);
//	}

	avsCleanManuallySelected();
	//avsToggle(avsObj, ev);
	submitAVS(avsObj);

	//if (currentSelected != null) {
	//	//avsToggle(currentSelected, ev);
	//}

}*/

function showOverlay(img_overlay) {
	document.getElementById(img_overlay).style.opacity = 1;
}

function hideOverlay(img_overlay) {
	document.getElementById(img_overlay).style.opacity = 0;
}

const imgResult = (res, borderColor, img_loading="eager") => {
		jsonString = JSON.stringify(res);
		return `
		<div class="result-border" style="border-color: ${borderColor};">
			<div class="myimg-thumbnail"  id="${res.imgId}" lang="${res.videoId}|${res.videoUrlPreview}" >
				<img loading="${img_loading}" id="img${res.imgId}" class="myimg"  src="${res.thumb}" onclick='avsCleanManuallySelected(); avsToggle(${jsonString}, event)' />
			</div>
			<div  id="toolbar_icons_${res.imgId}">
				<a class="font-tiny" title="View annotations of ${res.frameName},  Score: ${res.score}" href="indexedData.html?videoId=${res.videoId}&id=${res.imgId}" target="_blank"> ${res.frameNumber}</a>
				<a title="Video summary" href="javascript:void(0);" onclick="openChildWindow('${res.videoId}', '${res.imgId}', '${res.frameName}')"><i class="fa fa-th font-normal" style="padding-left: 3px;"></i></a>
				<a href="#" title="Play Video"><i title="Play Video" class="fa fa-play font-normal" style="color:#007bff;padding-left: 3px;" onclick="playVideoWindow('${res.videoUrl}', '${res.videoId}', '${res.imgId}'); return false;"></i></a>
				<a href="#" class="isSimplified" title="image similarity"><img loading="${img_loading}" style="padding: 2px;" src="img/comboSim.svg" width=20 title="image similarity" alt="${res.imgId}" id="comboSim${res.imgId}" onclick="var queryObj=new Object(); queryObj.comboVisualSim='${res.imgId}'; searchByLink(queryObj); return false;"></a>
				<a href="#" class="isAdvanced" title="Visual similarity"><img loading="${img_loading}" style="padding: 2px;" src="img/imgSim.png" width=20 title="Visual similarity (dinov2)" alt="${res.imgId}" id="gemSim${res.imgId}" onclick="var queryObj=new Object(); queryObj.vf='${res.imgId}'; searchByLink(queryObj); return false;"></a>
				<a href="#" class="isAdvanced" title="semantic similarity""><img loading="${img_loading}" style="padding: 2px;" src="img/aladinSim.svg" width=20 title="semantic similarity" alt="${res.imgId}" id="aladinSim${res.imgId}" onclick="var queryObj=new Object(); queryObj.aladinSim='${res.imgId}'; searchByLink(queryObj); return false;"></a>
				<a href="#" class="isAdvanced" title="semantic video  similarity"><img loading="${img_loading}" style="padding: 2px;" src="img/clipSim.svg" width=20 title="semantic video  similarity" alt="${res.imgId}" id="clipSim${res.imgId}" onclick="var queryObj=new Object(); queryObj.clipSim='${res.imgId}'; searchByLink(queryObj); return false;"></a>

				<a href="#" title="Submit result"><span class="pull-right"><i id="submitBTN_${res.imgId}" title="Submit result" class="fa fa-arrow-alt-circle-up font-huge" style="color:#00AA00; padding-left: 0px;" onclick='submitVersion2(${jsonString});'> </i></span></a>
			<div>
		</div>
		`

}

function openChildWindow(videoId, imgId, frameName) {
    var childWindow = window.open("showVideoKeyframes.html?videoId=" + videoId + "&id=" + imgId + "#" + frameName, "_blank");

    // Assegna la funzione o la variabile alla finestra figlia
    childWindow.submitFromChild = function(arg1) {
        // Implementazione della funzione nella finestra figlia
        console.log("submitResults chiamato nella finestra figlia con argomenti:");
    };
}

function playVideoWindow(videoURL, videoId, imgId) {
	let params = `scrollbars=no,status=no,location=no,toolbar=no,menubar=no,width=850,height=710,left=50,top=50`;
	var time = getStartTime(imgId);
	var myWindow = window.open("videoPlayer.html?videoid=" + videoId + "&frameid=" + imgId + "&url=" + videoURL + "&t=" + time, "playvideo", params);
}

function generateUUID(color) {
	var d = new Date().getTime();
	if (window.performance && typeof window.performance.now === "function") {
		d += performance.now(); // use high-precision timer if available
	}
	var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,
		function (c) {
			var r = (d + Math.random() * 16) % 16 | 0;
			d = Math.floor(d / 16);
			return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
		});
	if (color)
		uuid = 'color_' + uuid;
	return uuid;
}

$(document).on('click', ".deleteBtn", function (event) {
	console.log("active canvas: " + activeCanvasIdx);
	activeCanvas.getObjects().forEach(function (o) {
		if (o.uuid === event.target.id) {
			activeCanvas.discardActiveObject().renderAll();
			activeCanvas.remove(o);
		}
	})
	$("#" + event.target.id).remove();
	searchByForm();
});

dropImage = function (e) {

	activeCanvas = canvas0;
	activeCanvasIdx = 0;
	var pointer = canvas1.getPointer(event.e);
	let posX = pointer.x;
	let posY = pointer.y;
	if ((posX >= 0 && posX <= canvasWidth) && (posY >= 0 && posY <= canvasHeight)) {
		activeCanvas = canvas1;
		activeCanvasIdx = 1;
	}

	if (draggedLabel != '') {
		scale = 14;

		let dt = e.originalEvent.dataTransfer, files = dt.files;
		e = e || window.event;
		e.preventDefault();
		e.stopPropagation();
		let textVal = e.target.id;

		$('.refs').removeClass('highlight');

		if (e.target.nodeName == "CANVAS") {
			let pointer = activeCanvas.getPointer(e);
			let origX = pointer.x;
			let origY = pointer.y;
			let imgElement = document.getElementById(draggedLabel);
			let color = imgElement.alt == 'color' ? true : false;

			rect = new fabric.Image(imgElement, {
				left: origX - 25,
				top: origY - 30,
				fill: '',
				stroke: 'black',
				type: 'rect',
				uuid: generateUUID(color),
				strokeWidth: 1,
				scaleX: scale / imgElement.width,
				scaleY: scale / imgElement.height
			});
			activeCanvas.add(rect);
			activeCanvas.discardActiveObject();

			addDeleteBtn(draggedLabel, rect);
			activeObj = rect;
			rect = null;

			isCanvasClean[activeCanvasIdx] = false;
			isReset = false;

			searchByForm();

			canvasObjects = activeCanvas.getObjects();
			activeCanvas.on('object:scaling', (e) => {// FRANCA
				var o = e.target;
				if (!o.strokeWidthUnscaled && o.strokeWidth) {
					o.strokeWidthUnscaled = o.strokeWidth;
				}
				if (o.strokeWidthUnscaled) {
					o.strokeWidth = o.strokeWidthUnscaled / o.scaleX;
				}
			});
		}

		isDragging = false;
		draggedLabel = '';
	}
}

function indexedCells(txt) {
	console.log("indexedCells " + txt);
	res = txt.trim().split(" ");
	cellTxt = [];
	for (i = 0; i < res.length; i++) {
		txt = '';
		key = res[i].substring(0, 2);
		if (cellTxt[key])
			txt = cellTxt[key];
		style = colorMap[res[i].substring(2)] == null ? '<div>'
			+ res[i].substring(2) + '</div>' : '<div '
			+ colorMap[res[i].substring(2)] + '>' + res[i].substring(2)
		+ '</div>';
		txt += style;
		cellTxt[key] = txt;
		console.log(cellTxt[0]);

	}
	imgtable = '<table id="cellTable" style="width: 825px;">';
	imgtable += '<tr><td align="center"></td><td align="center">a</td><td align="center">b</td><td align="center">c</td><td align="center">d</td><td align="center">e</td>	<td align="center">f</td><td align="center">g</td>';
	counter = 0;
	row = 0;
	for (y = 0; y < CELL_ROWS; y++) {
		for (x = 0; x < CELL_COLS; x++) {
			if (counter % CELL_COLS == 0) {
				imgtable += '<tr>';
				imgtable += '<td style="width: 16px;">' + row++ + '</td>';

			}
			imgtable += '<td valign="top" style="border: 1px solid black; width: 115px;">'
				+ cellTxt[y.toString() + String.fromCharCode(97 + x)]
				+ '</td>';
			counter++;
		}
	}
	imgtable += '</table>'

	$('#txt').append(imgtable);
}

/*
function changeQueryBySampleMod(mode) {
	if (mode == "url") {
		document.getElementById("uploadText").style.display = 'none';
		document.getElementById("uploadLink").style.display = '';
		document.getElementById("urlText").style.display = '';
		document.getElementById("urlLink").style.display = 'none';
		document.getElementById("imageToUpload").style.display = 'none';
		document.getElementById("urlToUpload").style.display = '';
		document.getElementById("imageToUpload").value = '';

		document.getElementById("searchbar").enctype = "";
		document.getElementById("searchbar").method = "GET";
	} else {
		document.getElementById("uploadText").style.display = '';
		document.getElementById("uploadLink").style.display = 'none';
		document.getElementById("urlText").style.display = 'none';
		document.getElementById("urlLink").style.display = '';

		document.getElementById("urlToUpload").style.display = 'none';
		document.getElementById("imageToUpload").style.display = '';
		document.getElementById("urlToUpload").value = '';

		document.getElementById("searchbar").enctype = "multipart/form-data";
		document.getElementById("searchbar").method = "POST";
	}
}
*/

function includeHTML() {
	let z, i, elmnt, file, xhttp;
	/* Loop through a collection of all HTML elements: */
	z = document.getElementsByTagName("*");
	for (let i = 0; i < z.length; i++) {
		elmnt = z[i];
		/*search for elements with a certain atrribute:*/
		file = elmnt.getAttribute("w3-include-html");
		if (file) {
			/* Make an HTTP request using the attribute value as the file name: */
			xhttp = new XMLHttpRequest();
			xhttp.onreadystatechange = function () {
				if (this.readyState == 4) {
					if (this.status == 200) { elmnt.innerHTML = this.responseText; }
					if (this.status == 404) { elmnt.innerHTML = "Page not found."; }
					/* Remove the attribute, and call this function once more: */
					elmnt.removeAttribute("w3-include-html");
					includeHTML();
				}
			}
			xhttp.open("GET", file, true);
			xhttp.send();
			/* Exit the function: */
			return;
		}
	}
}

function canvasClean(idx) {
	prevOccur[idx] = $('#and' + idx).is(':checked');
	$('input:radio[name=occur' + idx + ']')[0].checked = true;
	/*
		prevTextual[idx] = $("#textual" + idx).val();
		$("#textual" + idx).val('');

		if ($('#textualMode' + idx).is(':checked')) {
			prevTextualMode[idx] = "aladin";
		}
		else
			prevTextualMode[idx] = "clip";
		$('#textualMode' + idx).prop('checked', false);
	*/
	prevNotField[idx] = $("#not" + idx).val();
	$("#not" + idx).val('');

	if ($('#isColor' + idx).is(':checked')) {
		prevIsColor[idx] = true;
	}
	else
		prevIsColor[idx] = false;
	$('#isColor' + idx).prop('checked', false);

	if ($('#isGray' + idx).is(':checked')) {
		prevIsGray[idx] = true;
	}
	else
		prevIsGray[idx] = false;
	$('#isGray' + idx).prop('checked', false);

	prevCanvasObjects[idx] = canvases[idx].getObjects();

	canvases[idx].discardActiveObject().renderAll();
	canvases[idx].getObjects().forEach(function (o) {
		console.log("----> " + o.get('type'));
		if (o.get('type') != 'line') {
			$("#" + o.get('uuid')).hide();
			canvases[idx].remove(o);
		}
	})
}

function reset() {
	canvasClean(0);
	canvasClean(1);
	prevSimreorder = simreorder;
	$('#simreorder').prop('checked', false);

	resetCanvas();
}

function undoReset() {
	canvasCleanUndo(0);
	canvasCleanUndo(1);
	$('#simreorder').prop('checked', prevSimreorder);

	undoCanvas();
}

function canvasCleanUndo(idx) {
	if (prevOccur[idx] == false)
		$('input:radio[name=occur' + idx + ']')[1].checked = true;
	/*$("#textual" + idx).val(prevTextual[idx]);

	if (prevTextualMode[idx] == "aladin")
		$('#textualMode' + idx).prop('checked', true);*/

	if (prevIsColor[idx] == true)
		$('#isColor' + idx).prop('checked', true);

	if (prevIsGray[idx] == true)
		$('#isGray' + idx).prop('checked', true);

	$('#or0').prop('checked', !prevOccur[0]);

	$("#not" + idx).val(prevNotField[idx]);
	prevCanvasObjects[idx].forEach(function (o) {
		if (o.get('type') != 'line') {
			canvases[idx].add(o);
			$("#" + o.get('uuid')).show();
		}
	})
}

function displayAdvancedToggle() {
	isAdvanced = !isAdvanced;
	displayAdvanced();
	resultsVisualization();


}

function resultsVisualization() {
	if (isAdvanced) {
		$('.isAdvanced').css('display', 'inline-block');
		$('.isSimplified').css('display', 'none');
	}

	else {
		$('.isSimplified').css('display', 'inline-block');
		$('.isAdvanced').css('display', 'none');
	}
}

function initLayout() {
	//document.getElementById('simplified0').appendChild(document.getElementById('div_textual0'));
	//document.getElementById('simplified1').appendChild(document.getElementById('div_textual1'));
	//document.getElementById('simplified0').appendChild(document.getElementById('textualOptions0'));
	//document.getElementById('simplified1').appendChild(document.getElementById('textualOptions1'));
	$('#simplified0').append($('#div_textual0'));
	$('#simplified1').append($('#div_textual1'));
	$('#simplified0').append($('#textualOptions0'));
	$('#simplified1').append($('#textualOptions1'));

	//------da settate all'inizio senza farlo da javascript
	$('#simplified1').css('display', 'none');
	$('#textual0').removeClass('textualquery0');
	$('#visionelogo').removeClass('visioneLogo');

	$('#simplified0').addClass('simplifiedSearchBar');
	$('#visionelogo').addClass('visioneLogo_bigger');

	$('#textual0').addClass('simplifiedTextual0');
	//$('#textualOptions0').css('display', 'none');
	//$('#textualOptions1').css('display', 'none');
	//-----
}

function displayAdvanced() {
	if (isAdvanced) {
		setDisplayTo = "block";
		$('#block0').css('display', 'block');
		$('#block1').css('display', 'block');
		$('#advSim1').css('display', 'block');
		$('#advSim1').css('display', 'block');
		//$('#textualOptions0').css('display', 'block');
		//$('#textualOptions1').css('display', 'block');

		//Restore the width of the left sidebar
		$('.sidebarGrid').css('width', '310');
		$('.bodyGrid').css('grid-template-columns', '1fr 4.2fr 0fr');
	} else {
		setDisplayTo = "none";
		$('#block0').css('display', 'none');
		$('#block1').css('display', 'none');
		$('#advSim1').css('display', 'none');
		$('#advSim1').css('display', 'none');
		//$('#textualOptions0').css('display', 'none');
		//$('#textualOptions1').css('display', 'none');

		//Set to 0 the left sidebar
		$('.sidebarGrid').css('width', '0');
		$('.bodyGrid').css('grid-template-columns', '0fr 4.2fr 0fr');
	}

	$('.advanced').css('display', setDisplayTo);


	//if (latestQuery != "" || isAdvanced) {
	//$('#sceneDes1').css('display', 'block');
	//if ($("#sceneDes1").length > 0)
	$('#simplified1').css('display', 'block');

	//document.getElementById("sceneDes0").className = 'fa fa-hourglass-start fa-2x'
	//document.getElementById("simplified0").className = 'simplified0'
	//document.getElementById("textual0").className = 'textualquery0'
	//document.getElementById("visionelogo").className = 'visioneLogo'

	$('#simplified0').removeClass('simplifiedSearchBar');
	$('#textual0').removeClass('simplifiedTextual0');
	$('#visionelogo').removeClass('visioneLogo_bigger');

	//$('#sceneDes0').addClass('fa-hourglass-start');
	//$('#simplified0').addClass('simplified0');
	$('#textual0').addClass('textualquery0');
	$('#visionelogo').addClass('visioneLogo');
	$('#hourglass-start').css('display', 'block');
	$('#hourglass-end').css('display', 'block');

	//$('#newsession').css('display', 'block');

	//}
	/*else {
		//$('#sceneDes1').css('display', 'none');
		$('#simplified1').css('display', 'none');
		//document.getElementById("simplified0").className = 'simplifiedSearchBar'
		//$('#sceneDes0').removeClass('fa-hourglass-start');
		//$('#simplified0').removeClass('simplified0');
		$('#textual0').removeClass('textualquery0');
		$('#visionelogo').removeClass('visioneLogo');

		$('#simplified0').addClass('simplifiedSearchBar');
		$('#visionelogo').addClass('visioneLogo_bigger');

		//document.getElementById("textual0").className = 'textualquery0'
		//document.getElementById("textual0").className = 'simplifiedTextual0'
		//document.getElementById("visionelogo").className = 'visioneLogo_bigger'
		$('#textual0').addClass('simplifiedTextual0');

		//$('#newsession').css('display', 'none');

		//document.getElementById("sceneDes0").className = 'fa fa-2x'
	}*/
	var elements = document.getElementsByClassName("advanced");
	for (var i = 0; i < elements.length; i++) {
		elements[i].style.display = setDisplayTo;
	}
	//searchByForm();
}

//create a function that create an input text with a microphone icon inside the input text
function createInputTextWithMic() {
	var inputText = document.createElement("input");
	inputText.setAttribute("type", "text");
	inputText.setAttribute("id", "inputText");
	inputText.setAttribute("class", "form-control");
	inputText.setAttribute("placeholder", "Search by voice");
	var micIcon = document.createElement("i");
	micIcon.setAttribute("class", "fa fa-microphone");
	micIcon.setAttribute("id", "micIcon");
	micIcon.setAttribute("aria-hidden", "true");
	micIcon.setAttribute("onclick", "startDictation(event)");
	inputText.appendChild(micIcon);
	console.log(inputText);
	return inputText;
}

function scrollToRow(rowNumber) {
	var colIdx = 0;

	var container = document.querySelector('.resGrid2');

	var containerTop = container.offsetTop;
	var containerHeight = container.offsetHeight;
	var containerBottom = containerTop + containerHeight;


	var row = document.getElementById("img" + resMatrix[Math.max(0, rowNumber)][colIdx].imgId);

	var rowTop = row.offsetTop;
	var rowHeight = row.offsetHeight;

	container.scrollTop = rowTop - containerTop - rowHeight / 2;


	/*
		if (rowTop - t < containerTop) {
			// La riga è sopra la parte correntemente visibile
			container.scrollTop = rowTop;
		} else if (rowTop -t > containerHeight) {
			// La riga è sotto la parte correntemente visibile
			container.scrollTop = rowTop - rowHeight - containerHeight;
		}*/

	/*
		if (rowTop < containerTop) {
			// La riga è sopra la parte correntemente visibile
			container.scrollTop = rowTop;
		} else if (rowTop + rowHeight > containerTop + containerHeight) {
			// La riga è sotto la parte correntemente visibile
			container.scrollTop = rowTop - rowHeight - containerHeight;
		}*/
}

function unscrollToRow(rowNumber) {
	var colIdx = 0;

	var container = document.querySelector('.resGrid2');
	var containerTop = container.offsetTop;

	var row = document.getElementById("img" + resMatrix[Math.max(0, rowNumber)][colIdx].imgId);

	var rowTop = row.offsetTop;

	// La riga è sopra la parte correntemente visibile
	//valore hardcoded. Bisognerebbe calcolare l'altezza dell'immagine selezionata
	container.scrollTop = rowTop - - rowHeight / 2;

}

//var colIdx = 0;
var selectContentOffsetY = 0;
var selectContentOffsetX = 0;
var gridOffsetY = -selectContentOffsetY;
var gridOffsetX = -selectContentOffsetX;
var gridOffsetY = -selectContentOffsetY;
var gridOffsetX = -selectContentOffsetX;
var lastSelected = null;
var prevSelected = null;
var scrollOffset = -1.5;
var rowHeight = 0;
var scrollingOffset = 0;

function translateText(textQuery, idx) {
	$.ajax({
		type: "POST",
		async: true,
		crossDomain: true,
		data: { text: textQuery, lang: localStorage.getItem("selectedLang") },
		dataType: "text",
		url: translateService + "/text",
		success: function (data) {
			console.log(data)
			setTranslate(data, idx);

		},
		error: function (data) {
			setTranslate(null, idx);
		}
	});
	//return JSON.parse('{"lang":"it","translated":true,"translation":"the pipo"}');
}

function initSupportedLanguages() {
	localStorage.setItem("supportedLanguages", '{"AutoDetect": "auto", "Afrikaans": "afr", "Arabic": "arb", "Armenian": "hye", "Belarusian": "bel", "Bosnian": "bos", "Bulgarian": "bul", "Chinese": "cmn", "Croatian": "hrv", "Czech": "ces", "Danish": "dan", "Dutch": "nld", "Estonian": "est", "Finnish": "fin", "French": "fra", "Georgian": "kat", "German": "deu", "Greek": "ell", "Hebrew": "heb", "Hindi": "hin", "Hungarian": "hun", "Icelandic": "isl", "Indonesian": "ind", "Irish": "gle", "Italian": "ita", "Japanese": "jpn", "Korean": "kor", "Lithuanian": "lit", "Macedonian": "mkd", "Malayalam": "mal", "Maltese": "mlt", "Nepali": "npi", "Norwegian": "nno", "Polish": "pol", "Portuguese": "por", "Romanian": "ron", "Russian": "rus", "Serbian": "srp", "Slovak": "slk", "Slovenian": "slv", "Spanish": "spa", "Swedish": "swe", "Turkish": "tur", "Ukrainian": "ukr", "Vietnamese": "vie"}');

	if (localStorage.getItem("supportedLanguages") ==  null) {
		$.ajax({
			type: "POST",
			async: true,
			crossDomain: true,
			data: {},
			dataType: "text",
			url: translateService + "/supported_languages",
			success: function (data) {
				console.log(data)
				localStorage.setItem('supportedLanguages', data);
				setSupportedLanguages(0);
				setSupportedLanguages(1);
			},
			error: function (data) {
				console.log("Error loading supported languages " + data);
			}
		});
	} else {
		setSupportedLanguages(0);
		setSupportedLanguages(1);
	}
	//return JSON.parse('{"lang":"it","translated":true,"translation":"the pipo"}');
}

function setSupportedLanguages(id) {
	supportedLanguages = JSON.parse(localStorage.getItem("supportedLanguages"))

	var selectElement = document.getElementById('supportedLang' + id);

	// Popola l'elemento select con le opzioni del dizionario
	/*for (var key in supportedLanguages) {
	  if (supportedLanguages.hasOwnProperty(key)) {
		var option = document.createElement('option');
		option.value = supportedLanguages[key];
		option.text = key;
		selectElement.add(option);
	  }
	}*/


	$.each(supportedLanguages, function(key, value) {
		var isSelected = (value === localStorage.getItem("selectedLang"));
		$('#supportedLang' + id).append($('<option>', {
			text: key,
			value: value,
		  	selected: isSelected
		}));
	  });

	  $('#supportedLang0, #supportedLang1').on('change', function() {
		var selectedValue = $(this).val();
		localStorage.setItem("selectedLang", selectedValue);
		var otherSelect = $(this).is('#supportedLang0') ? $('#supportedLang1') : $('#supportedLang0');
		otherSelect.val(selectedValue);
	  });

}

function checkKey(e) {
	if (!resMatrix || resMatrix.length == 0)
		return;

	e = e || window.event;
	//console.log(e.keyCode)
	var goToNextResult = false;

	/*var activeElement = document.activeElement;
	if (activeElement.id === "textual0" || activeElement.id === "textual1") {
		var idx = activeElement.id == "textual0" ? 0 : 1;

		console.log(activeElement.id);
		if (e.key === 'Enter') {
			var textQuery =  activeElement.value;
			if (textQuery.length > 0) {
				if (document.getElementById("isTranslate" + idx).checked)
					translateText(textQuery, idx);
			console.log(activeElement.value);
			}
		  }
		return;
	}
	else if (activeElement.tagName == "INPUT" || activeElement.getAttribute("type") == "text" || activeElement.tagName === "TEXTAREA" || avsManually.size === 0) {
		return;
	}*/
	var activeElement = document.activeElement;
	//if (activeElement.tagName == "INPUT" || activeElement.getAttribute("type") == "text" || activeElement.tagName === "TEXTAREA" || avsManually.size === 0)
	if (activeElement.tagName == "INPUT" || activeElement.getAttribute("type") == "text" || activeElement.tagName === "TEXTAREA")
		return;

	if (e.keyCode == '65') {

		//var mouseOverEvent = new Event('mouseenter');

		//let imgId4Regex = lastSelected.id.replaceAll("/", "\\/").replaceAll(".", "\\.")
		/*if (prevSelected != null) {
			let prevImgId4Regex = prevSelected.id.replaceAll("/", "\\/").replaceAll(".", "\\.")
			$('#' + prevImgId4Regex).off("contextmenu");
		}*/

		//$('#' + imgId4Regex).off("contextmenu")
		//$('#' + imgId4Regex).trigger( "contextmenu" );
		/*var testElement = $('#' + imgId4Regex);

		console.log(testElement);
		var rightClickEvent = $.Event("contextmenu");

		testElement.trigger(rightClickEvent);*/

		if (prevSelected != null) {
			var prevSel = document.getElementById(prevSelected.id);
			var mouseOutEvent = new MouseEvent("mouseout", {
				bubbles: true,
				cancelable: true,
			});

			prevSel.dispatchEvent(mouseOutEvent);
		}

		var testDiv = document.getElementById(lastSelected.id);

		var mouseOverEvent = new MouseEvent("mouseover", {
			bubbles: true,
			cancelable: true,
		});

		testDiv.dispatchEvent(mouseOverEvent);


		var rightClickEvent = new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
			view: window,
		});

		testDiv.dispatchEvent(rightClickEvent);

		/*

				testDiv.addEventListener("contextmenu", function(event) {
					event.preventDefault(); // Opzionale: previene il menu contestuale predefinito
					// Inserisci qui il tuo codice per l'evento click del tasto destro del mouse
				  });
		*/

		//testDiv.dispatchEvent(mouseOverEvent);
	}
	else if (e.keyCode == '83') {
		return;
		//replace img to submitBTN_
		submitId = lastSelected.id.replace("img", "submitBTN_");
		document.getElementById(submitId).click();
		//submitBTN_${res.imgId}


		//submitVersion2()
		goToNextResult = true;
	}

	else if (e.keyCode == '38') {
		selectPrevResult();
		/*
		colIdx = 0;
		rowIdx = Math.max(0, rowIdx - 1);
		//console.log(resCursor)
		//$("#" + res[resCursor--].imgId).click();
		var element = document.getElementById("img" + resMatrix[rowIdx][colIdx].imgId);
		if (lastSelected != null) {
			lastSelected.click();
		}
		prevSelected = lastSelected;
		lastSelected = element;

		// Chiamare l'evento onclick
		element.click();*/

		//scrollToRow(rowIdx);


		/*
				var container = document.querySelector('.resGrid2');

				var containerTop = container.getBoundingClientRect().top;
				var containerBottom = containerTop + container.offsetHeight;

				var percentVisible = 0;
				numCycle = 0;
				while (percentVisible < 100 && numCycle++ < 10) {
					var elementTop = element.getBoundingClientRect().top;
					var elementBottom = elementTop + element.offsetHeight;

					if (elementTop >= containerTop && elementTop <= containerBottom) {
						var visibleHeight = Math.min(elementBottom, containerBottom) - elementTop;
						var elementHeight = element.offsetHeight;
						var percentVisible = (visibleHeight / elementHeight) * 100;
					}
					if (percentVisible < 100) {
						var gridContent = $("#content").find(".resGrid2");
						scrollingOffset = Math.max(0, scrollingOffset - 250)
						gridContent.animate({ scrollTop: scrollingOffset }, 0);
					}
					console.log("percentVisible: " + percentVisible);
				}
		*/


		/*gridOffsetY = Math.max(0, gridOffsetY - rowHeight);
		var gridContent = $("#content").find(".contentGrid");
		gridContent.animate({ scrollTop: gridOffsetY }, 0);
		rowHeight = document.getElementById("res_" + resMatrix[resCursor][colIdx].imgId).offsetHeight + scrollOffset;*/


		//console.log("up arrow")
	}
	if (e.keyCode == '40' || goToNextResult) {
		loadingNextResults();

		selectNextResult();


		//scrollToRow(rowIdx);

		/*

				var container = document.querySelector('.resGrid2');

				var containerTop = container.getBoundingClientRect().top;
				var containerBottom = containerTop + container.offsetHeight;

				var percentVisible = 0;
				numCycle = 0;
				while (percentVisible < 100 && numCycle++ < 10) {

					var elementTop = element.getBoundingClientRect().top;
					var elementBottom = elementTop + element.offsetHeight;

					if (elementTop >= containerTop && elementTop <= containerBottom) {
						var visibleHeight = Math.min(elementBottom, containerBottom) - elementTop;
						var elementHeight = element.offsetHeight;
						percentVisible = (visibleHeight / elementHeight) * 100;
					}
					if (percentVisible < 100) {
						var gridContent = $("#content").find(".resGrid2");
						scrollingOffset += 250
						gridContent.animate({ scrollTop: scrollingOffset }, 0);
					}
					console.log("percentVisible: " + percentVisible);
				}
				/*

						var gridItems = container.querySelectorAll('.item');
						var selectedRow = gridItems[resCursor]; // Riga 25 (indice 24 considerando 0-based index)

						var containerTop = container.getBoundingClientRect().top;
						var containerHeight = container.offsetHeight;
						var selectedRowTop = selectedRow.getBoundingClientRect().top;

						if (selectedRowTop >= containerTop && selectedRowTop <= containerTop + containerHeight) {
						console.log("La riga 25 è visibile");
						} else {
							console.log("La riga 25 è al di sotto dello scroll");
							gridOffsetY = gridOffsetY + rowHeight ;
							var gridContent = $("#content").find(".contentGrid");
							//gridContent.animate({ scrollTop: gridOffsetY }, 0);
							gridContent.animate({ scrollTop: 200 }, 0);

							resRow = document.getElementById("res_" + resMatrix[resCursor][colIdx].imgId)
							rowHeight = resRow.offsetHeight - scrollOffset
						}*/


		//console.log("down arrow")
	}
	else if (e.keyCode == '37') {
		colIdx = Math.max(0, colIdx - 1);
		//$("#" + res[resCursor--].imgId).click();
		var element = document.getElementById("img" + resMatrix[rowIdx][Math.max(0, colIdx)].imgId);
		if (lastSelected != null) {
			lastSelected.click();
			//lastSelected.style.display = 'block'

		}
		prevSelected = lastSelected;
		lastSelected = element;
		element.click();
		/*gridOffsetX = Math.max(0, gridOffsetX - selectContentOffsetX);
		var gridContent = $("#content").find(".contentGrid");*/
		//var gridContent = $("#content").find(".contentGrid");
		//gridContent.animate({ scrollLeft: 0 }, 0);


		//console.log("left arrow")
	}
	else if (e.keyCode == '39') {
		++colIdx
		//$("#" + res[resCursor++].imgId).click();
		try {
			var element = document.getElementById("img" + resMatrix[rowIdx][colIdx].imgId);
		} catch (error) {
			--colIdx;
			return;
		}
		if (lastSelected != null) {
			lastSelected.click();
			//document.getElementById("res_" + lastSelected.id).style.display = 'none'
		}
		prevSelected = lastSelected;
		lastSelected = element;
		element.click();
		/*$("#content.gridItem:nth-child(" + colIdx + ")").addClass("hideColumn");
		gridOffsetX = gridOffsetX + selectContentOffsetX;
		var gridContent = $("#content").find(".contentGrid");
		gridContent.animate({ scrollLeft: gridOffsetX }, 100);*/
		//var gridContent = $("#content").find(".contentGrid");
		//gridContent.animate({ scrollLeft: 0 }, 0);
		//console.log("right arrow")

	}

}

function selectNextResult() {
	while (rowIdx < (resMatrix.length - 1)) {
		try {
				//if (rowIdx >= (resMatrix.length - 1))
				//return;
			colIdx = 0;
			rowIdx++;
			//console.log(rowIdx)

			//$("#" + res[resCursor++].imgId).click();
			var element = document.getElementById("img" + resMatrix[rowIdx][colIdx].imgId);
			if (lastSelected != null) {
				lastSelected.click();
			}
			prevSelected = lastSelected;
			lastSelected = element;

			// Chiamare l'evento onclick
			element.click();
			break;
		} catch (error) {
			console.log(error);
		}
	}

}

function selectPrevResult() {
	while (rowIdx > 0) {
		try {
			colIdx = 0;
			//rowIdx = Math.max(0, rowIdx - 1);
			rowIdx--;
			//console.log(resCursor)
			//$("#" + res[resCursor--].imgId).click();
			var element = document.getElementById("img" + resMatrix[rowIdx][colIdx].imgId);
			if (lastSelected != null) {
				lastSelected.click();
			}
			prevSelected = lastSelected;
			lastSelected = element;

			// Chiamare l'evento onclick
			element.click();
			break;
		} catch (error) {
			console.log(error);
		}
	}

}


async function init() {
	setTaskType(sessionStorage.getItem('taskType'));

	document.onkeydown = checkKey;
	if (localStorage.getItem("selectedLang") ==  null) {
		localStorage.setItem('selectedLang', defaultLanguage);
	}

	$(function () {
		$("#dialog").dialog({
			autoOpen: false
		});
	});
	includeHTML();
	await loadConfig();
	//localStorage.setItem('isQA', false);
	collectionName = config?.main?.collection_name;
	//$("#visionelogo").append("<div align='right'><h2>" + collectionName + " - " + localStorage.getItem('taskType').toUpperCase() + "<h2></div>");
	// $("#visionelogo").append("<div align='right'><h2><label id='collectionLabel'>" + collectionName + "</label> - <label id='taskTypeLabel'>" + localStorage.getItem('taskType').toUpperCase() + "</label></h2></div>");



	if (config?.main?.collection_name) document.title = config.main.collection_name + " - " + document.title;
	setNumResultsPerVideo();
	loadPalette();
	$("#searchTab").append(searchForm(0, 'Objects & colors of the scene', " Describe the scene you are looking for...", "fa fa-hourglass-start fa-1x"));
	//$("#searchTab").append("<div><img src='img/bug.gif' width=30 height=15></div>")
	//$("#searchTab").append(addButton);
	document.getElementById('avsSubmittedTab').style.display = 'block'
	if ($('meta[name=task]').attr('content') == "KIS") {
		$("#searchTab").append(searchForm(1, 'Objects & color next scene', " Describe the next scene (optional)...", "fa fa-hourglass-end fa-1x"));
	} else {
		document.getElementById('avsSubmittedTab').style.display = 'block'
	}
	//$("#searchTab").append(addButton);
	// loadConfig().then(loadPalette)//.then(checkServices);
	canvas0 = get_canvas('canvas0', 'annotations0', 'not0');
	canvas1 = get_canvas('canvas1', 'annotations1', 'not1');
	canvases = [canvas0, canvas1];

	$('#content').on('drop', dropImage);

	$("#clean0").on('click', function (e) {
		if (!isCanvasClean[0]) {
			isCanvasClean[0] = true;
			canvasClean(0);
			searchByForm();
			//performSearch(cell2Text(0), cell2Text(1));
		}
	});

	$("#clean1").on('click', function (e) {
		if (!isCanvasClean[1]) {
			isCanvasClean[1] = true;
			canvasClean(1);
			//performSearch(cell2Text(0), cell2Text(1));
			searchByForm();
		}
	});

	$("#reset").on('click', function (e) {
		if (!isReset) {
			isReset = true;
			reset();
			//performSearch(cell2Text(0), cell2Text(1));
			searchByForm();
		}
	});

	$("#textual0")
		.keyup(
			function (event) {
				if (event.keyCode === 13) {
					$("#textual0")
						.val(
							$("#textual0")
								.val()
								.replace(
									/(\r\n|\n|\r)/gm,
									""));
					var textQuery = $("#textual0").val();
					if (textQuery.length > 0) {
						if (document.getElementById("isTranslate0").checked)
							translateText(textQuery, 0);
						else {
							queryByTextual();
						}
					}
					//queryByTextual();
					$('#textual0').blur();
				}
				if ($("#textual0").val() == "")
					document.getElementById('cancelText0').style.display = 'none'
				else
					document.getElementById('cancelText0').style.display = 'block'
			});

	$("#textual1")
		.keyup(
			function (event) {
				if (event.keyCode === 13) {
					$("#textual1")
						.val(
							$(
								"#textual1")
								.val()
								.replace(
									/(\r\n|\n|\r)/gm,
									""));
					var textQuery = $("#textual1").val();
					if (textQuery.length > 0) {
						if (document.getElementById("isTranslate1").checked)
							translateText(textQuery, 1);
						else {
							queryByTextual();
						}
					}
					//queryByTextual();
					$('#textual1').blur();

				}
				if ($("#textual1").val() == "")
					document.getElementById('cancelText1').style.display = 'none'
				else
					document.getElementById('cancelText1').style.display = 'block'
			})

	$("#undo0").on('click', function (e) {
		if (isCanvasClean[0]) {
			isCanvasClean[0] = false;
			canvasCleanUndo(0);
			//performSearch(cell2Text(0), cell2Text(1));
			searchByForm();
		}
	});

	$("#undo1").on('click', function (e) {
		if (isCanvasClean[1]) {
			isCanvasClean[1] = false;
			canvasCleanUndo(1);
			//performSearch(cell2Text(0), cell2Text(1));
			searchByForm();
		}
	});

	$("#undoReset").on('click', function (e) {
		if (isReset) {
			isReset = false;
			undoReset();
			//performSearch(cell2Text(0), cell2Text(1));
			searchByForm();
		}
	});

	var blink0 = null;
	var blink1 = null;

	$("#recordButton0")
		.on(
			'click',
			function (e) {
				if ($("#recordButton0").css('color') == "rgb(0, 128, 0)") {
					document.getElementById('cancelText0').style.display = 'none'
					$("#textual0").val("")
					$("#recordButton0").css('color', 'red');
					$("#recordButton0").css('padding-top', '12px');
					$("#recordButton0").css('font-size', 'x-large');
					blink0 = setInterval(() => {
						$('#recordButton0').fadeIn();
						$('#recordButton0').fadeOut();
					}, 100);

					startRecording(0);
				}
				else {
					clearInterval(blink0);
					$('#recordButton0').finish();
					$('#recordButton0').show();
					$("#recordButton0").css('color', 'green');
					$("#recordButton0").css('padding-top', '15px');
					$("#recordButton0").css('font-size', 'medium');


					stopRecording(0);

				}
			});

	$("#recordButton1")
		.on(
			'click',
			function (e) {
				if ($("#recordButton1").css('color') == "rgb(0, 128, 0)") {
					document.getElementById('cancelText1').style.display = 'none'
					$("#textual1").val("")

					$("#recordButton1").css('color', 'red');
					$("#recordButton1").css('padding-top', '12px');
					$("#recordButton1").css('font-size', 'x-large');
					blink1 = setInterval(() => {
						$('#recordButton1').fadeIn();
						$('#recordButton1').fadeOut();
					}, 100);
					startRecording(1);
				}
				else {
					clearInterval(blink1);
					$('#recordButton1').finish();
					$('#recordButton1').show();
					$("#recordButton1").css('color', 'green');
					$("#recordButton1").css('padding-top', '15px');
					$("#recordButton1").css('font-size', 'medium');

					stopRecording(1);

				}

			});

	$("#cancelText0")
		.on(
			'click',
			function (e) {
				$("#textual0").val('');
				document.getElementById('cancelText0').style.display = 'none'
				searchByForm();


			});
	$("#cancelText1")
		.on(
			'click',
			function (e) {
				$("#textual1").val('');
				document.getElementById('cancelText1').style.display = 'none'
				searchByForm();

			});
	/*
								$("#stopButton0")
										.on(
												'click',
												function(e) {
													document
															.getElementById("recordButton0").style.display = 'block';
													document
															.getElementById("stopButton0").style.display = 'none';
													stopRecording(0);
												});

								$("#stopButton1")
										.on(
												'click',
												function(e) {
													document
															.getElementById("recordButton1").style.display = 'block';
													document
															.getElementById("stopButton1").style.display = 'none';
													stopRecording(1);
												});
	*/
	canvas0.renderAll();

	initLayout();

	//displayAdvanced(false);

	initSupportedLanguages();



	var script = document.createElement('script');
	script.src = "js/WebAudioRecorder/WebAudioRecorder.min.js";
	document.head.appendChild(script)
	script = document.createElement('script');
	script.src = "js/WebAudioRecorder/audioRecorder.js";
	document.head.appendChild(script);


	/*var script = document.createElement('script');
	script.src = "js/WebAudioRecorder/WebAudioRecorder.min.js";
	document.head.appendChild(script)
	script = document.createElement('script');
	script.src = "js/WebAudioRecorder/audioRecorder.js";
	document.head.appendChild(script)

	const microphoneIcon = document.querySelector('.microphone-icon');
	const inputText = document.querySelector('input[type="text"]');

	microphoneIcon.addEventListener('click', () => {
	  // Avvia la registrazione audio
	  console.log('Registrazione audio avviata');
	});*/


	var imgGridResultsElement = document.getElementById('imgGridResults');

/*
	imgGridResultsElement.addEventListener('scroll', function() {
		// Verifica se l'utente ha raggiunto la fine della pagina
		console.log('Scrolled!');
		if (visibleImages < res.length && window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
			// Carica il prossimo batch di immagini (ad esempio, altre 100 immagini)
			var nextBatchEndIndex = Math.min(visibleImages + batchSize, res.length);
			loadImages(visibleImages, nextBatchEndIndex);
		}
	});*/

	var resultsElement = $("#results");

	resultsElement.on("scroll mousewheel", function() {
		loadingNextResults();
	});

}

function loadingNextResults() {
	var resultsElement = $("#results");

	var containerHeight = resultsElement.height();
		var scrollableHeight = resultsElement.prop("scrollHeight");

		if (res != null) {
			if (visibleImages < res.length && resultsElement.scrollTop() + resultsElement.innerHeight() >= scrollableHeight - 200) {
				// Carica il prossimo batch di immagini
				var nextBatchEndIndex = Math.min(visibleImages + batchSize, res.length);
				loadImages(visibleImages, nextBatchEndIndex);
			}
		}

}


function loadPalette() {
	let palette = config?.ui?.objects?.palette || [];
	let dataArray = [];
	palette.forEach(item => {
		if (item.name)
			dataArray.push([item.name, 'palette/' + (item.url || item.name + '.png')]);
		if (item.break)
			dataArray.push(['-------']);
	});

	setPalette(dataArray);
	return dataArray;
}

function setNumResultsPerVideo() {
	numResultsPerVideo = config?.ui?.['max-results-per-video'] ?? 10;
}

async function checkServices() {
    let services_url = config?.services_urls || [];
    let message = "Warning, the following services return an error status:";
    let isError = false;

    // Funzione per effettuare la chiamata Fetch e gestire la risposta
    async function checkServiceStatus(key, url) {
        try {
            const response = await fetch(url);

            if (!response.ok) {
                isError = true;
                message += `\n${key}: ${response.status}`;
            }
        } catch (error) {
            // Gestione degli errori di rete o Fetch
            isError = true;
            message += `\n${key}: Network error or Fetch error`;
        }
    }

    // Array di promesse per le chiamate Fetch
    const fetchPromises = [];

    for (let key in services_url) {
        let value = services_url[key];
		let serviceName = key.replace(/_url$/, '');
        let url = value != null ? value : '/' + serviceName;

        // Aggiungi la promessa alla lista
        fetchPromises.push(checkServiceStatus(serviceName, url));
    }

    // Attendi che tutte le chiamate Fetch siano completate
    await Promise.all(fetchPromises);

    // Mostra l'alert se ci sono errori
    if (isError) {
        alert(message);
    }
}

function setPalette(palette) {
	const paletteElement = document.querySelector('.palette');
	const computedStyle = window.getComputedStyle(paletteElement);
	const gridTemplateColumns = computedStyle.getPropertyValue('grid-template-columns');

	const match = gridTemplateColumns.match(/\d+/);
	const gridColumns = match ? parseInt(match[0]) : null;


	let html = '';
	let idx = 0;
	for (let i = 0; i < palette.length; i++) {
		const line = palette[i];
		if (line[0].startsWith("#") || line[0].trim() == "")
			continue;

		if (line[0].startsWith("-------")) {
			span = gridColumns - idx % gridColumns;
			html += '<div class="column-span-' + span + '">';
			idx += span;

		} else {
			html += '<div>';
			html += '<img draggable="true" ondragstart="drag(event)" id="' + line[0].trim() + '" title="' + line[0].trim() + '" src="' + line[1].trim() + '" />'
			idx++;

		}
		html += '</div>';
	}
	$("#palette").append(html);
}

function noResultsOutput(isNoResult = true) {
	var elemento = $('#imgGridResults');
	if (isNoResult) {
		elemento.removeClass('gridcontainer');
		elemento.addClass('alert alert-danger');
		elemento.attr('role', 'alert');
		elemento.html('<strong>Ops!</strong> No results.');
	} else {
		elemento.removeClass('alert alert-danger');
		elemento.addClass('gridcontainer');
		elemento.attr('role', '');
	}

}

