
var cells = 49;
var canvasWidth = 288;
var canvasHeight = 160;

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

var urlBSService = '';
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
var dataset = "v3c";
var latestQuery = "";
var setDisplayTo = "block";
var isAdvanced = false
var resCursor = 0;
var resMatrix = [];


function handler() {
	if (this.readyState == 4 && this.status == 200) {
		console.log(this.responseText)
		var myObj = JSON.parse(this.responseText);
		urlBSService = myObj.serviceUrl;
		speech2TextService = myObj.speech2Text;
		thumbnailUrl = myObj.thumbnailUrl;
		keyFramesUrl = myObj.keyFramesUrl;
		videoUrlPrefix = myObj.videoUrl;
		videoshrinkUrl = myObj.videoshrinkUrl;

	}

}

function setCollection(collection) {
	confFile = "conf.json"
	dataset = "v3c"
	var client = new XMLHttpRequest();
	client.onload = handler;
	if (collection == "mvk") {
		dataset = "mvk"
		confFile = "conf_mvk.json"

	}
	client.open("GET", "js/" + confFile, false);
	client.send();
}

var client = new XMLHttpRequest();
client.onload = handler;
client.open("GET", "js/conf.json", false);
client.send();

function mvkTab() {
	//if (confirm('Switching to Marine Dataset?')) {
	dataset = "mvk";
	window.location.href = 'index_MVK.html';
	setCollection("mvk")

	//}
}

function v3cTab() {
	//if (confirm('Switching to V3C Dataset?')) {
	dataset = "v3c";
	window.location.href = 'index_V3C.html';
	setCollection("v3c")
	//}
}

function setSpeech(speechRes, idx) {
	if (speechRes == null) {
		console.log("Warning, speechRes is " + speechRes);
		prevTextual[idx] = $("#textual" + idx).val();
		$("#textual" + idx).val('');
	}

	else {
		console.log(speechRes);
		let jsonSpeech = JSON.parse(speechRes)

		$("#textual" + idx).val(jsonSpeech.translation);
		searchByForm();
		idx = Math.floor(Math.random() * 3);
		if (jsonSpeech.translation.length > 50) {
			prevTextual[idx] = $("#textual" + idx).val();
			//jsonRes = JSON.parse(speechRes);
			//alert(messages[idx]);
		}
	}
}

function playVideo(id) {
	alert(id);
	alert(getStartTime(id + ".png"));
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

$.get($('meta[name=dataset]').attr('content') + '_objects_doc_freq.csv', function (data) {
	availableTags = data.split("\n");
	//availableTags = [];
});

draggedLabel = '';

function drag(ev) {
	ev.dataTransfer.setData("text", ev.target.id);
	console.log("drag " + ev.target.title);
	draggedLabel = ev.target.title;
}

function getText(id, field, collection = "v3c") {
	return $
		.ajax({
			type: "GET",
			url: urlBSService + "/getText?id=" + id + "&field=" + field + "&dataset=" + collection,
			async: false
		}).responseText
}

function getAllVideoKeyframes(videoId) {
	return $
		.ajax({
			type: "GET",
			url: urlBSService + "/getAllVideoKeyframes?videoId=" + videoId + "&dataset=" + collection,
			async: false
		}).responseText
}

function getField(id, field) {
	return $
		.ajax({
			type: "GET",
			url: urlBSService + "/getField?id=" + id + "&field=" + field + "&dataset=" + collection,
			async: false
		}).responseText
}

function getStartTime(id) {
	return $
		.ajax({
			type: "GET",
			url: urlBSService + "/getStartTime?id=" + id + "&dataset=" + dataset,
			async: false
		}).responseText
}

function getEndTime(id) {
	return $
		.ajax({
			type: "GET",
			url: urlBSService + "/getEndTime?id=" + id + "&dataset=" + dataset,
			async: false
		}).responseText
}

function getMiddleTimestamp(id) {
	return $
		.ajax({
			type: "GET",
			url: urlBSService + "/getMiddleTimestamp?id=" + id + "&dataset=" + dataset,
			async: false
		}).responseText
}

function submitWithAlert(id, videoId, collection) {
	if (confirm('Are you sure you want to submit?')) {
		res = submitResult(id, videoId, collection);
		console.log(res);
		alert('Server response: ' + res);
	}
}

//to remove
function startNewSession() {
	if (confirm('Are you sure you want to start a new session?')) {
		location.reload();
		$.ajax({
			type: "GET",
			async: false,
			url: urlBSService + "/init"
		}).responseText
	}
}

function startNewKISSession() {
	//if (confirm('Starting a new KIS session?')) {
	location.href = "index_V3C.html";
	$.ajax({
		type: "GET",
		async: false,
		url: urlBSService + "/init"
	}).responseText
	setCollection("v3c")
	//}
}

function startNewAVSSession() {
	//if (confirm('Starting a new AVS session?')) {
	location.href = "index_V3C_AVS.html";
	$.ajax({
		type: "GET",
		async: false,
		url: urlBSService + "/init"
	}).responseText
	setCollection("v3c")
	//}
}

function startNewMVKAVSSession() {
	//if (confirm('Starting a new AVS session?')) {
	location.href = "index_MVK_AVS.html";
	$.ajax({
		type: "GET",
		async: false,
		url: urlBSService + "/init"
	}).responseText
	setCollection("mvk")
	//}
}

function startNewMVKKISSession() {
	//if (confirm('Starting a new KIS session?')) {
	location.href = "index_MVK.html";
	$.ajax({
		type: "GET",
		async: false,
		url: urlBSService + "/init"
	}).responseText
	setCollection("mvk")
	//}
}

function submitResult(id, videoId, collection) {
	return $.ajax({
		type: "GET",
		async: false,
		url: urlBSService + "/submitResult?id=" + id + "&videoid=" + videoId + "&dataset=" + collection,
	}).responseText;
}

function submitAtTime(videoId, time) {
	return $.ajax({
		type: "GET",
		async: false,
		url: urlBSService + "/submitResult?videoid=" + videoId + "&time=" + time,
	}).responseText;
}

function log(query) {
	return $.ajax({
		type: "GET",
		async: false,
		url: urlBSService + "/log?query=" + query,
	}).responseText;
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

	var btnLeft = x - 3;
	var btnTop = y - 9;
	var labelLeft = rect.left;
	var labelTop = y - 30;

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
	if (!isCanvasEnabled[idx])
		return null;
	//is43 = $("#is43").is(":checked");
	//is169 = $("#is169").is(":checked");
	isColor[idx] = $("#isColor" + idx).is(":checked");
	isGray[idx] = $("#isGray" + idx).is(":checked");
	//occur = $('input[name="occur' + idx + '"]:checked').val();
	//simreorder = $("#simreorder").is(":checked");

	let queryObj = new Object();
	let queryParameters = {};

	let objects = '';
	let txt = '';
	let query = '';
	let colors = [];

	console.log(idx);
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

	let textual = '';
	element = $("#textual" + idx);
	if (element.length > 0) {
		textual = element.val().trim().replace(/[^\x21-\x7E]+/g, ' ');
	}

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

	if (textual != '') {
		queryObj.textual = textual;
		queryParameters['textualMode'] = textualMode[idx];
	}

	//	if (clip != '')
	//		queryObj.clip = clip;

	if (txt != '' && isAdvanced)
		queryObj.txt = txt.trim();
	if (Object.keys(queryObj).length > 0 && isAdvanced) {
		queryParameters['occur'] = occur[idx];
		queryParameters['simReorder'] = simreorder.toString();
	}

	console.log("Query " + queryObj);
	console.log("Query Parameters " + queryParameters);
	if (Object.keys(queryObj).length == 0)
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
	results = data;
	//results = sortByVideo(data);
	resultsSortedByVideo = results;
	groupResults(document.getElementById("group"));
	// history.pushState(JSON.stringify($(this)),'List',window.location.href);
}

function search2(query) {
	latestQuery = query
	if (query == "") {
		setResults(query)
	} else {
		console.log(query);

		$.ajax({
			type: "POST",
			async: true,
			crossDomain: true,
			data: { query: query, simreorder: simreorder, dataset: dataset },
			dataType: "text",
			url: urlBSService + "/search",
			success: function (data) {
				setResults(data)
			},
			error: function (data) {
				setResults(data);
			}
		});

	}
}

function searchByALADINSimilarity(query) {
	$.ajax({
		type: "POST",
		data: { query: query },
		dataType: "text",
		url: urlBSService + "/search",
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
		url: urlBSService + "/search",
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
				let collection = res[i].collection;

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
	searchByForm();
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
	document.getElementById("sceneDes0").className = 'fa fa-hourglass-start fa-2x'
	document.getElementById('simplified0').appendChild(document.getElementById('textualOptions0'));
	document.getElementById('simplified1').appendChild(document.getElementById('textualOptions1'));
}

function showResults(data) {
	if ($('meta[name=task]').attr('content') == "AVS") {
		avsCleanManualSelected();
		avsRemoveAutoselected();
	}
	//empty avsFirstCol
	//avsAutoSelected.length = 0
	$('html,body').scrollTop(0);
	$("#imgGridResults").remove();
	//$('#results').scrollTop(0);
	$('#content').scrollTop(0);
	resCursor = -1;
	resMatrix = [];
	var imgGridResults = '<div id="imgGridResults" class="gridcontainer">';

	if ((data == null || data == "") && latestQuery != "") {
		imgGridResults = '<div id="imgGridResults" class="alert alert-danger" role="alert"> <strong>Ops!</strong> No results.';
		$("#results").append(imgGridResults);
	} else if (data != null && data != "") {
		if (!isAdvanced)
			displaySimplifiedUI();

		res = JSON.parse(data);
		if (res.length == 0)
			imgGridResults = '<div id="imgGridResults" class="alert alert-danger" role="alert"> <strong>Ops!</strong> No results.';
		else {
			document.getElementById('block1').style.display = 'block';
			document.getElementById('newsession').style.display = 'block';

			let prevID = '';

			let itemPerRow = 0;
			let columnIdx = 1;
			let rowIdx = 0;
			resMatrix[rowIdx] = [];
			for (let i = 0; i < res.length; i++) {
				let imgId = res[i].imgId;
				let videoId = res[i].videoId;

				let score = res[i].score;
				let collection = res[i].collection;

				let path = collection + "/" + videoId + "/" + imgId;
				let frameNumber = imgId.split('_').pop();

				if (i > 0 && videoId != prevID) {
					resMatrix[++rowIdx] = [];
					let spanVal = 11 - columnIdx;
					columnIdx = 1;
					if (spanVal > 0)
						imgGridResults += '<div class="column-span-' + spanVal + '"></div>';
					imgGridResults += '<div class="hline column-span-11"></div>';
				}

				if (videoId != prevID) {
					//imgGridResults += '<div id="video_' + videoId + '">';
					imgGridResults += '<div class="item column-span-1"><a href="showVideoKeyframes.html?collection=' + collection + '&videoId=' + videoId + '&id=' + imgId + '" target="_blank">' + videoId + '<a></div>';

				}
				let borderColorsIdx = fromIDtoColor(videoId, borderColors.length);
				prevID = videoId;
				let videoUrl = videoUrlPrefix + videoId + ".mp4";
				videoUrlPreview = videoshrinkUrl + videoId + ".mp4";
				//videoUrlPreview = videoUrl + "videoshrink/"+videoId+".mp4";
				avsObj = getAvsObj(collection, videoId, imgId, 'avs_' + imgId, thumbnailUrl + path, keyFramesUrl + path)
				resultData = getResultData(collection, videoId, imgId, thumbnailUrl + path, imgId, frameNumber, score, videoUrl, videoUrlPreview)

				/*if (itemPerRow == 0)
					if (!avsAuto.has(imgId) && !avsSubmitted.has(videoId))
						addToAutoSelected(avsObj)*/

				imgGridResults += '<div id="res_' + imgId + '" class="item column-span-1">'
				imgGridResults += imgResult(resultData, borderColors[borderColorsIdx], avsObj, true)
				imgGridResults += '</div>'
				resMatrix[rowIdx][columnIdx -1] = res[i];

				columnIdx++;

			}
		}
		imgGridResults += '</div>';
		$("#results").append(imgGridResults);
		if (res.length > 1) {
			for (let i = 0; i < res.length; i++) {
				let imgId = res[i].imgId;
				let score = res[i].score;
				let collection = res[i].collection;

				let imgId4Regex = imgId.replaceAll("/", "\\/").replaceAll(".", "\\.")
				let cip = $('#' + imgId4Regex).hover(hoverVideo, hideVideo);

				function hoverVideo(e) {
					id4Regex = this.id.replaceAll("/", "\\/").replaceAll(".", "\\.")
					$('#' + id4Regex).contextmenu(function () {
						imgId = 'img' + id4Regex;
						langInfo = this.lang.split('|');
						var collection = langInfo[0];
						videoId = langInfo[1];
						videourl = langInfo[2];
						playerId = 'video' + videoId;

						var elementExists = document.getElementById(playerId);

						//var startTime = getStartTime(this.id);
						//var endTime = getEndTime(this.id);
						var middleTime = getMiddleTimestamp(this.id);
						var startTime = middleTime - 2;
						var endTime = middleTime + 2;
						if (elementExists != null) {
							$('#' + playerId).get(0).pause();
							$('#' + playerId).attr('src', videourl + '#t=' + startTime + ',' + endTime);
							$('#' + playerId).get(0).load();
							$('#' + playerId).get(0).play();
							return;
						}
						backgroundImg = "background-image: url('" + thumbnailUrl + collection + '/' + this.id + "')";

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
					collection = langInfo[0];
					videoId = langInfo[1];
					videourl = langInfo[2];
					playerId = 'video' + videoId;

					var elementExists = document.getElementById(playerId);
					if (elementExists != null) {
						$('#' + playerId).remove();
						$('#' + imgId).css("display", "block");
					}
				}
			}
		}
	}
	if ($('meta[name=task]').attr('content') == "AVS") {
		avsHideSubmittedVideos();
		avsReloadManualSelected();
		avsAddAutoselected();
	}
}

function getResultData(collection, videoId, imgId, thumb, frameName, frameNumber, score, videoUrl, videoUrlPreview, avsObj) {
	let resultData = new Object();
	resultData.collection = collection;
	resultData.videoId = videoId;
	resultData.imgId = imgId;
	resultData.thumb = thumb;
	resultData.frameName = frameName;
	resultData.frameNumber = frameNumber;
	resultData.score = score;
	resultData.videoUrl = videoUrl;
	resultData.videoUrlPreview = videoUrlPreview;
	resultData.avsObj = avsObj;
	return resultData
}

const imgResult = (res, borderColor, avsObj, isSimplified = false) => {

	if (isSimplified) {
		return `
			<input style="display: none;" class="checkboxAvs" id="avs_${res.imgId}" type="checkbox" title="select for AVS Task" onchange="updateAVSTab('avs_${res.imgId}', '${res.thumb}', '${res.imgId} ')">&nbsp;
			<a style="font-size:10px;" title="${res.frameName}  Score: ${res.score}" href="indexedData.html?collection=${res.collection}&videoId=${res.videoId}&id=${res.imgId}" target="_blank"> ${res.frameNumber}</a>
			<a href="showVideoKeyframes.html?collection=${res.collection}&videoId=${res.videoId}&id=${res.imgId}#${res.frameName}" target="_blank"><i class="fa fa-th" style="font-size:13px;  padding-left: 3px;"></i></a>
			<i class="fa fa-play" style="font-size:13px; color:#007bff;padding-left: 3px;" onclick="playVideoWindow('${res.videoUrl}', '${res.videoId}', '${res.imgId}'); return false;"></i>
			<img loading="lazy" style="padding: 2px;" src="img/gem_icon.svg" width=20 title="image similarity" alt="${res.imgId}" id="comboSim${res.imgId}" onclick="var queryObj=new Object(); queryObj.comboVisualSim='${res.imgId}'; searchByLink(queryObj); return false;">
			<img loading="lazy" style="display:none; padding: 2px;" src="img/gem_icon.svg" width=20 title="Visual similarity" alt="${res.imgId}" id="gemSim${res.imgId}" onclick="var queryObj=new Object(); queryObj.vf='${res.imgId}'; searchByLink(queryObj); return false;">
			<span class="pull-right"><i title="Submit result" class="fa fa-arrow-alt-circle-up" style="font-size:17px; color:#00AA00; padding-left: 0px;" onclick="submitWithAlert('${res.imgId}','${res.videoId}','${res.collection}'); return false;"></i></span>'
			<div class="myimg-thumbnail" style="border-color:${borderColor};" id="${res.imgId}" lang="${res.collection}|${res.videoId}|${res.videoUrlPreview}" onclick='avsCleanManualSelected(); avsToggle(${avsObj}, event)'>
	
	
			<img loading="lazy" id="img${res.imgId}" class="myimg"  src="${res.thumb}"/>
			</div>

		`
	}

	return `
		<input style="display: none;" class="checkboxAvs" id="avs_${res.imgId}" type="checkbox" title="select for AVS Task" onchange="updateAVSTab('avs_${res.imgId}', '${res.thumb}', '${res.imgId} ')">&nbsp;
		<a style="font-size:10px;" title="${res.frameName}  Score: ${res.score}" href="indexedData.html?collection=${res.collection}&videoId=${res.videoId}&id=${res.imgId}" target="_blank"> ${res.frameNumber}</a>
		<a href="showVideoKeyframes.html?collection=${res.collection}&videoId=${res.videoId}&id=${res.imgId}#${res.frameName}" target="_blank"><i class="fa fa-th" style="font-size:13px;  padding-left: 3px;"></i></a>
		<i class="fa fa-play" style="font-size:13px; color:#007bff;padding-left: 3px;" onclick="playVideoWindow('${res.videoUrl}', '${res.videoId}', '${res.imgId}'); return false;"></i>
		<img loading="lazy" style="padding: 2px;" src="img/gem_icon.svg" width=20 title="image similarity" alt="${res.imgId}" id="comboSim${res.imgId}" onclick="var queryObj=new Object(); queryObj.comboVisualSim='${res.imgId}'; searchByLink(queryObj); return false;">
		<img loading="lazy" style="display:none; padding: 2px;" src="img/gem_icon.svg" width=20 title="image similarity" alt="${res.imgId}" id="gemSim${res.imgId}" onclick="var queryObj=new Object(); queryObj.vf='${res.imgId}'; searchByLink(queryObj); return false;">
		<img loading="lazy" style="padding: 2px;" src="img/aladin_icon.svg" width=20 title="semantic similarity" alt="${res.imgId}" id="aladinSim${res.imgId}" onclick="var queryObj=new Object(); queryObj.aladinSim='${res.imgId}'; searchByLink(queryObj); return false;">
		<img loading="lazy" style="padding: 2px;" src="img/clip_icon.svg" width=20 title="semantic video  similarity" alt="${res.imgId}" id="clipSim${res.imgId}" onclick="var queryObj=new Object(); queryObj.clipSim='${res.imgId}'; searchByLink(queryObj); return false;">
		<span class="pull-right"><i title="Submit result" class="fa fa-arrow-alt-circle-up" style="font-size:17px; color:#00AA00; padding-left: 0px;" onclick="submitWithAlert('${res.imgId}','${res.videoId}','${res.collection}'); return false;"></i></span>'
		<div class="myimg-thumbnail" style="border-color:${borderColor};" id="${res.imgId}" lang="${res.collection}collection|${res.videoId}|${res.videoId}|${res.videoUrlPreview}" onclick='avsCleanManualSelected(); avsToggle(${avsObj}, event)'>


		<img loading="lazy" id="img${res.imgId}" class="myimg"  src="${res.thumb}"/>
		</div>
		`
}

function playVideoWindow(videoURL, videoId, imgId) {
	let params = `scrollbars=no,status=no,location=no,toolbar=no,menubar=no,width=850,height=710,left=50,top=50`;
	var time = getStartTime(imgId);
	var myWindow = window.open("videoPlayer.html?videoid=" + videoId + "&url=" + videoURL + "&t=" + time, "playvideo", params);
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

	let activeCanvas = canvas0;
	let activeCanvasIdx = 0;
	var pointer = canvas1.getPointer(event.e);
	let posX = pointer.x;
	let posY = pointer.y;
	if ((posX >= 0 && posX <= canvasWidth) && (posY >= 0 && posY <= canvasHeight)) {
		activeCanvas = canvas1;
		activeCanvasIdx = 1;
	}

	if (draggedLabel != '') {
		scale = 16;

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
			if (color) {
				scale = 11;
			}
			console.log(scale + "------------------ELEMENTO " + imgElement.src)

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

	prevTextual[idx] = $("#textual" + idx).val();
	$("#textual" + idx).val('');

	if ($('#textualMode' + idx).is(':checked')) {
		prevTextualMode[idx] = "aladin";
	}
	else
		prevTextualMode[idx] = "clip";
	$('#textualMode' + idx).prop('checked', false);

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
	$("#textual" + idx).val(prevTextual[idx]);

	if (prevTextualMode[idx] == "aladin")
		$('#textualMode' + idx).prop('checked', true);

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
	if (isAdvanced) {
		displayAdvanced(false);
	}
	else {
		displayAdvanced(true);
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

	//document.getElementById('newsession').style.display = 'none';
	$('#newsession').css('display', 'none');

}

function displayAdvanced(isAdv) {
	isAdvanced = isAdv;

	if (isAdvanced) {
		setDisplayTo = "block";
		$('#block0').css('display', 'block');
		$('#block1').css('display', 'block');
		$('#textualOptions0').css('display', 'block');
		$('#textualOptions1').css('display', 'block');
	} else {
		setDisplayTo = "none";
		$('#block0').css('display', 'none');
		$('#block1').css('display', 'none');
		$('#textualOptions0').css('display', 'none');
		$('#textualOptions1').css('display', 'none');
	}

	if (latestQuery != "" || isAdvanced) {
		$('#sceneDes1').css('display', 'block');
		if ($("#sceneDes1").length > 0)
			$('#simplified1').css('display', 'block');

		//document.getElementById("sceneDes0").className = 'fa fa-hourglass-start fa-2x'
		//document.getElementById("simplified0").className = 'simplified0'
		//document.getElementById("textual0").className = 'textualquery0'
		//document.getElementById("visionelogo").className = 'visioneLogo'

		$('#simplified0').removeClass('simplifiedSearchBar');
		$('#textual0').removeClass('simplifiedTextual0');
		$('#visionelogo').removeClass('visioneLogo_bigger');

		$('#sceneDes0').addClass('fa-hourglass-start');
		$('#simplified0').addClass('simplified0');
		$('#textual0').addClass('textualquery0');
		$('#visionelogo').addClass('visioneLogo');

		$('#newsession').css('display', 'block');

	} else {
		$('#sceneDes1').css('display', 'none');
		$('#simplified1').css('display', 'none');
		//document.getElementById("simplified0").className = 'simplifiedSearchBar'
		$('#sceneDes0').removeClass('fa-hourglass-start');
		$('#simplified0').removeClass('simplified0');
		$('#textual0').removeClass('textualquery0');
		$('#visionelogo').removeClass('visioneLogo');

		$('#simplified0').addClass('simplifiedSearchBar');

		//document.getElementById("textual0").className = 'textualquery0'
		//document.getElementById("textual0").className = 'simplifiedTextual0'
		//document.getElementById("visionelogo").className = 'visioneLogo_bigger'
		$('#textual0').addClass('simplifiedTextual0');
		$('#visionelogo').addClass('visioneLogo_bigger');

		$('#newsession').css('display', 'none');

		//document.getElementById("sceneDes0").className = 'fa fa-2x'
	}
	var elements = document.getElementsByClassName("advanced");
	for (var i = 0; i < elements.length; i++) {
		elements[i].style.display = setDisplayTo;
	}
	searchByForm();
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

var colIdx = 0;
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

function checkKey(e) {

	e = e || window.event;
	console.log(e.keyCode)

	if (e.keyCode == '65') {

		//var mouseOverEvent = new Event('mouseenter');

		let imgId4Regex = lastSelected.id.replaceAll("/", "\\/").replaceAll(".", "\\.")
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
	else if (e.keyCode == '38') {
		colIdx = 0;
		resCursor = Math.max(0, resCursor -1);
		console.log(resCursor)
		//$("#" + res[resCursor--].imgId).click();
		var element = document.getElementById(resMatrix[resCursor][colIdx].imgId);
		if (lastSelected != null) {
			lastSelected.click();
		}
		prevSelected = lastSelected;
		lastSelected = element;

		// Chiamare l'evento onclick
		element.click();


		gridOffsetY = Math.max(0, gridOffsetY - rowHeight);
		var gridContent = $("#content").find(".contentGrid");
		gridContent.animate({ scrollTop: gridOffsetY }, 0);
		rowHeight = document.getElementById("res_" + resMatrix[resCursor][colIdx].imgId).offsetHeight + scrollOffset;


		console.log("up arrow")
	}
	else if (e.keyCode == '40') {
		colIdx = 0;
		resCursor++;
		console.log(resCursor)

		//$("#" + res[resCursor++].imgId).click();
		var element = document.getElementById(resMatrix[resCursor][colIdx].imgId);
		if (lastSelected != null) {
			lastSelected.click();
		}
		prevSelected = lastSelected;
		lastSelected = element;

		// Chiamare l'evento onclick
		element.click();

		gridOffsetY = gridOffsetY + rowHeight ;
		var gridContent = $("#content").find(".contentGrid");
		gridContent.animate({ scrollTop: gridOffsetY }, 0);

		resRow = document.getElementById("res_" + resMatrix[resCursor][colIdx].imgId)
		rowHeight = resRow.offsetHeight - scrollOffset


		console.log("down arrow")
	}
	else if (e.keyCode == '37') {
		colIdx = Math.max(0, colIdx -1);
		//$("#" + res[resCursor--].imgId).click();
		var element = document.getElementById(resMatrix[resCursor][Math.max(0,colIdx)].imgId);
		if (lastSelected != null) {
			lastSelected.click();
			//lastSelected.style.display = 'block'

		}
		prevSelected = lastSelected;
		lastSelected = element;
		element.click();
		/*gridOffsetX = Math.max(0, gridOffsetX - selectContentOffsetX);
		var gridContent = $("#content").find(".contentGrid");*/
		var gridContent = $("#content").find(".contentGrid");
		gridContent.animate({ scrollLeft: 0 }, 0);


		console.log("left arrow")
	}
	else if (e.keyCode == '39') {
		++colIdx
		//$("#" + res[resCursor++].imgId).click();
		try {
			var element = document.getElementById(resMatrix[resCursor][colIdx].imgId);
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
		var gridContent = $("#content").find(".contentGrid");
		gridContent.animate({ scrollLeft: 0 }, 0);
		console.log("right arrow")

	}

}


function init() {

	document.onkeydown = checkKey;



	$(function () {
		$("#dialog").dialog({
			autoOpen: false
		});
	});
	includeHTML();
	setCollection("v3c")

	$("#searchTab").append(searchForm(0, 'Objects & colors of the scene', " Describe the scene", "fa fa-hourglass-start fa-1x"));
	//$("#searchTab").append("<div><img src='img/bug.gif' width=30 height=15></div>")
	//$("#searchTab").append(addButton);
	if ($('meta[name=task]').attr('content') == "KIS") {
		$("#searchTab").append(searchForm(1, 'Objects & color of the next scene', " Describe the next scene(optional)", "fa fa-hourglass-end fa-1x"));
	} else {
		document.getElementById('avsSubmittedTab').style.display = 'block'
	}
	//$("#searchTab").append(addButton);
	loadPalette('palette.csv');
	canvas0 = get_canvas('canvas0', 'annotations0',
		'not0');
	canvas1 = get_canvas('canvas1', 'annotations1',
		'not1');
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
							$(
								"#textual0")
								.val()
								.replace(
									/(\r\n|\n|\r)/gm,
									""));
					queryByTextual();
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
					queryByTextual();
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

	displayAdvanced(false);


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

}


function loadPalette(url) {
	return fetch(url)
		.then(response => {
			if (!response.ok) {
				throw new Error('Failed to fetch the file.');
			}
			return response.text();
		})
		.then(csvData => {
			const rowsArray = csvData.split('\n');
			const dataArray = rowsArray.map(row => row.split(','));
			setPalette(dataArray);
			return dataArray;
		});
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
