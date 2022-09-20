
var cells = 49;
var widthCanvas = 250;
var heightCanvas= 140;

CELL_COLS = 7;
CELL_ROWS = 7;

var cellWidth = widthCanvas / CELL_COLS;
var cellHeight = heightCanvas /CELL_ROWS;

var borderColors = ["#63b598", "#ce7d78", "#ea9e70", "#a48a9e", "#c6e1e8", "#648177" ,"#0d5ac1" ,
	"#f205e6" ,"#1c0365" ,"#14a9ad" ,"#4ca2f9" ,"#a4e43f" ,"#d298e2" ,"#6119d0",
	"#d2737d" ,"#c0a43c" ,"#f2510e" ,"#651be6" ,"#79806e" ,"#61da5e" ,"#cd2f00" ,
	"#9348af" ,"#01ac53" ,"#c5a4fb" ,"#996635","#b11573" ,"#4bb473" ,"#75d89e" ,
	"#2f3f94" ,"#2f7b99" ,"#da967d" ,"#34891f" ,"#b0d87b" ,"#ca4751" ,"#7e50a8" ,
	"#c4d647" ,"#e0eeb8" ,"#11dec1" ,"#289812" ,"#566ca0" ,"#ffdbe1" ,"#2f1179" ,
	"#935b6d" ,"#916988" ,"#513d98" ,"#aead3a", "#9e6d71", "#4b5bdc", "#0cd36d",
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
	'white' : 'style="background-color: white; color: rgb(0,0,0);  border: 1px solid #000;"',
	'black' : 'style="background-color: black; color: rgb(255,255,255);"',
	'blue' : 'style="background-color: blue; color: rgb(255,255,255);"',
	'brown' : 'style="background-color: brown; color: rgb(255,255,255);"',
	'green' : 'style="background-color: green; color: rgb(255,255,255);"',
	'grey' : 'style="background-color: grey; color: rgb(255,255,255);"',
	'orange' : 'style="background-color: orange; color: rgb(255,255,255);"',
	'pink' : 'style="background-color: pink; color: rgb(255,255,255);"',
	'purple' : 'style="background-color: purple; color: rgb(255,255,255);"',
	'red' : 'style="background-color: red; color: rgb(255,255,255);"',
	'yellow' : 'style="background-color: yellow; color: rgb(0,0,0);"'
};

var availableTags = null;

var rect, isDrawing = false, origX, origY, textVal, activeObj, overObj;
var prevQuery=[];


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
var prevIsGray =[];

var results = null;
var resultsSortedByVideo = null;
var isGray = [];
var isColor = [];
var occur = ['and', 'and'];
var textualMode =  ["clip", "clip"];
var simreorder = false;

//var qbeUrl = ''
var is43 = false;
var is169 = false;

var urlBSService ='' ;
var thumbnailUrl ='' ;
var keyFramesUrl ='';
var activeCanvasIdx = 0;
var activeCanvas = "";
var isCanvasEnabled = [true, true];
var prevIsCanvasEnabled = [];
var prevSimreorder = false;
var prevOccur=['and', 'and'];
var prevTextualMode=["clip", "clip"];

var prevQBE="";

const avsMap = new Map();
const avsMapHistory = new Map();
//const avsQueryLog = new Map();

var tempSearchForms = 2


function handler() {
	  if (this.readyState == 4 && this.status == 200) {
		  console.log(this.responseText)
	    var myObj = JSON.parse(this.responseText);
		  urlBSService = myObj.serviceUrl;
		  thumbnailUrl= myObj.thumbnailUrl;
		  keyFramesUrl=myObj.keyFramesUrl;
		  videoUrl=myObj.videoUrl;
		  videoshrinkUrl=myObj.videoshrinkUrl;

	  }
	  
	};
	
	
var client  = new XMLHttpRequest();
client.onload = handler;
client.open("GET", "js/conf.json", false);
client.send(); 

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

$.get('objects_doc_freq.csv', function(data) {
	availableTags = data.split("\n");
	//availableTags = [];
});


draggedLabel = '';

function drag(ev) {
	ev.dataTransfer.setData("text", ev.target.id);
	console.log("drag " + ev.target.title);
	draggedLabel = ev.target.title;
}

function getText(id, field) {
	return $
			.ajax({
				type : "GET",
				url :  urlBSService+"/getText?id="+ id + "&field=" + field,
				async : false
			}).responseText
}

function getField(id, field) {
	return $
			.ajax({
				type : "GET",
				url :  urlBSService+"/getField?id="+ id + "&field=" + field,
				async : false
			}).responseText
}

function getStartTime(id) {
	return $
			.ajax({
				type : "GET",
				url :  urlBSService+"/getStartTime?id="+ id,
				async : false
			}).responseText
}

function getEndTime(id) {
	return $
			.ajax({
				type : "GET",
				url :  urlBSService+"/getEndTime?id="+ id,
				async : false
			}).responseText
}

function getMiddleTimestamp(id) {
	return $
			.ajax({
				type : "GET",
				url :  urlBSService+"/getMiddleTimestamp?id="+ id,
				async : false
			}).responseText
}

function submitWithAlert(id) {
	if (confirm('Are you sure you want to submit?')) {
		res = submitResult(id);
		console.log(res);
		alert('Server response: ' + res);
	}
}

function startNewSession() {
	if (confirm('Are you sure you want to start a new session?')) {
		location.reload();
		$.ajax({
			type : "GET",
			async : false,
			url : urlBSService+"/init"
		}).responseText
	}
}

function submitAVS() {
	//if (confirm('Are you sure you want to submit AVS Images?')) {
		for (let pair of avsMap) {
	    	var [keyframeId, id] = pair;
			//res = submitResultAVS(keyframeId, avsQueryLog.get(keyframeId));
			res = submitResultAVS(keyframeId);
			console.log(res);
	
			avsRemoveItem(id, keyframeId, false);
			avsMapHistory.set(keyframeId, id);
		}
		updateAvsTitle();
//	}
}

function submitResultAVS(id) {
	return $.ajax({
		type : "GET",
		async : true,
		url : urlBSService+"/submitResult?id="+ id + "&isAVS=true&simreorder=" + simreorder,
	}).responseText;
}


function submitResult(id) {
	return $.ajax({
		type : "GET",
		async : false,
		url : urlBSService+"/submitResult?id="+ id,
	}).responseText;
}

function submitAtTime(videoId, time) {
	return $.ajax({
		type : "GET",
		async : false,
		url : urlBSService+"/submitResult?videoid="+ videoId+ "&time=" + time,
	}).responseText;
}

function log(query) {
	return $.ajax({
		type : "GET",
		async : false,
		url : urlBSService+"/log?query=" + query,
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
			+ '" src="Actions-dialog-close-icon.png" class="deleteBtn" style="position:absolute;top:'
			+ btnTop + 'px;left:' + btnLeft
			+ 'px;cursor:pointer;width:16px;height:16px;"/></div>';
	$(".canvas-container").eq(activeCanvasIdx).append(deleteBtn);}


function cell2Text(idx) {
	if (!isCanvasEnabled[idx])
		return null;
	//is43 = $("#is43").is(":checked");
	//is169 = $("#is169").is(":checked");
	isColor[idx] = $("#isColor" + idx).is(":checked");
	isGray[idx] = $("#isGray" + idx).is(":checked");
	//occur = $('input[name="occur' + idx + '"]:checked').val();
	//simreorder = $("#simreorder").is(":checked");
	
	var queryObj = new Object();
	var queryParameters = {};

	objects = '';
	txt = '';
	query = '';
	colors = [];
	
	console.log(idx);
	canvases[idx].getObjects().forEach(
		function(o) {
			if (o.get('type') == 'rect') {
				if (o && o.oCoords) {
					startCol = Math.floor(Math.max(0, o.oCoords.tl.x)
							/ cellWidth);
					endCol = Math.ceil(Math.min(widthCanvas, o.oCoords.tr.x)
							/ cellWidth);	resultsSortedByVideo = [];


					startRow = Math.floor(Math.max(0, o.oCoords.tr.y)
							/ cellHeight);
					endRow = Math.ceil(Math.min(heightCanvas, o.oCoords.br.y)
							/ cellHeight);
				} else {
					startCol = Math.floor(Math.max(0, o.left) / cellWidth);
					endCol = Math.ceil(Math.min(widthCanvas, (o.left + o.width))
							/ cellWidth);

					startRow = Math.floor(Math.max(0, o.top) / cellHeight);
					endRow = Math.ceil(Math.min(heightCanvas, (o.top + o.height))
							/ cellHeight);
				}
				label = $("#" + o.uuid).attr('title').trim();

				if (o.uuid.startsWith('color_')) {
					colors.push(label);
				} else {
					objects += label + " ";
				}

				for (row = startRow; row < endRow; row++) {
					for (col = startCol; col < endCol; col++) {
						// txt += col + String.fromCharCode(97 + row) +
						// label + '%5E' + boost + ' ' ;
						txt += row + String.fromCharCode(97 + col) + label
								+ ' ';
					}
				}
			}
		})
	console.log(colors);
	for (cIdx = 0; cIdx < colors.length; cIdx++) {
		objects += colors[cIdx] + " ";
	}
	
	if (isGray[idx]) {
		objects += "graykeyframe ";
	} else 	if (isColor[idx]) {
		objects += "colorkeyframe ";
	}
	
	if (is43) {
		objects += "ratio43 ";
	} else 	if (is169) {
		objects += "ratio169 ";
	}
	
	//textualMode = $("#textualmode" + idx).val().trim().replace(/[^\x21-\x7E]+/g, ' ');
	//clip = $("#clip" + idx).val().trim().replace(/[^\x21-\x7E]+/g, ' ');

	notField = $("#not" + idx).val().trim().replace(/[^\x21-\x7E]+/g, ' ');
	textual = $("#textual" + idx).val().trim().replace(/[^\x21-\x7E]+/g, ' ');

	if (notField != '') {
		items = notField.split(" ");
		parsedField = '';
		for (i = 0; i < items.length; i++) {
			if (!isNaN(items[i])) {
				freq = Math.max((+items[i] + 1), 0);
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
		console.log(objects.match('\\((.*?)\\)'));
		if ((group = objects.match('\\((.*?)\\)'))) {
			objects = objects.replace("\\(" + group[1] + "\\)", '');
			console.log("objects: " + objects);
			groups += group;
		}

		// console.log(a.match('\\((.*?)\\)')[1]);
		// console.log(a.replace(new RegExp("\\((.*?)\\)", "g"), ''));

		// or queries disabled
		// objects += groups;
	} else if (notField != '')
		objects = "*";
	
		objects += notField;

	if (objects != '')
		queryObj.objects = objects.trim();
	
	if (textual != '') {
		queryObj.textual = textual;
		queryParameters['textualMode'] = textualMode[idx];
	}
		
//	if (clip != '')
//		queryObj.clip = clip;

	if (txt != '')
		queryObj.txt = txt.trim();
	if (Object.keys(queryObj).length > 0) {
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
	time = Math.floor(new Date() / 1000);
	console.log(" DATE " + time);
	return ;
}

function searchByLink(queryID) {
	//prevQuery = query;
	if(queryID != null) {
		jsonString = JSON.stringify(queryID);
		jsonString = '{"query":[' + jsonString + '], "parameters":[{"simReorder":"' + simreorder.toString() + '"}]}';
		'{"query":' + jsonStringQuery + ', "parameters":' + jsonStringParameters +'}';
		//queryID = '{"query":[' + queryID + ']}';
		search2(jsonString);

		
	}
	else 
		$("#imgtable").remove();
}

function searchByForm() {
	queriesArr = []
	parameteresArr = []
	for (cellIndex = 0; cellIndex < tempSearchForms; cellIndex++) {
		cellQuery = cell2Text(cellIndex);
		if (cellQuery != null) {
			queriesArr.push(cellQuery[0])
			parameteresArr.push(cellQuery[1])
		}
	}		
	prevQuery = queriesArr;
	if(queriesArr.length > 0) {
		jsonStringQuery = JSON.stringify(queriesArr);
		jsonStringParameters = JSON.stringify(parameteresArr);
		jsonString = '{"query":' + jsonStringQuery + ', "parameters":' + jsonStringParameters +'}';
		search2(jsonString);
	}
	else 
		$("#imgtable").remove();
}

function search2(query) {

	console.log(query);

	$.ajax({
		type : "POST",
		async : true,
		data: {query: query, simreorder: simreorder},
		dataType : "text",
		url : urlBSService+"/search",
		success : function(data) {
			results = data;
			//results = sortByVideo(data);
			resultsSortedByVideo = results;
			groupResults(document.getElementById("group"));
			 // history.pushState(JSON.stringify($(this)),'List',window.location.href);
		},
		error : function(data) {
			$("#imgtable").remove();
		}
	});
}

function searchByTERNSimilarity(query) {
	$.ajax({
		type : "POST",
		data: {query: query},
		dataType : "text",
		url : urlBSService+"/search",
		success : function(data) {
			results = data;
			//results = sortByVideo(data);
			resultsSortedByVideo = results;
			groupResults(document.getElementById("group"));
			 // history.pushState(JSON.stringify($(this)),'List',window.location.href);
		},
		error : function(data) {
			$("#imgtable").remove();
		}
	});
}

function searchByCLIPSimilarity(query) {
	$.ajax({
		type : "POST",
		data: {query: query},
		dataType : "text",
		url : urlBSService+"/search",
		success : function(data) {
			results = data;
			//results = sortByVideo(data);
			resultsSortedByVideo = results;
			groupResults(document.getElementById("group"));
			 // history.pushState(JSON.stringify($(this)),'List',window.location.href);
		},
		error : function(data) {
			$("#imgtable").remove();
		}
	});
}

function sortByVideo(data) {
	resultsSortedByVideo = [];
	if (data != null && data.trim() != "") {
		var res = JSON.parse(data);

		console.log("Sort By Video "+res.length);
		if(res.length != 0){
		dataDict = {};
		
		keys = [];
		
		for (i = 0; i < res.length; i++) {
			imgId = res[i].imgId;
			score = res[i].score;
			collection = res[i].collection;
	
			resValues = imgId.split("/");
			videoID = resValues[0];
			idHref = resValues[1].split("\.")[0];
			value = dataDict[videoID];
			if (value == null) {
				value = [];
				keys[keys.length] = videoID;
			}
			value.push(res[i]);
			// console.log(res[i] + ' ' + res[i + 1] + ' ');
			dataDict[videoID] = value;
		}
		// console.log(keys);
		for (i = 0; i < keys.length; i++) {
			// console.log(i + " " + dataDict[keys[i]]);
			resPerVideo =  dataDict[keys[i]];
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
	if(checkBox = document.getElementById("isGray" + checkboxId).checked) {
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

function setTextualMode(checkboxId) {
	if(checkBox = document.getElementById("textualMode" + checkboxId).checked) {
		textualMode[checkboxId] = "tern";
	}
	else
		textualMode[checkboxId] = "clip";
	searchByForm();
}

function enableCanvas(canvasId, storePrev) {
	 document.getElementById("overlay" + canvasId).style.display = "none";
	$('input:radio[name=canvas' + canvasId +']')[0].checked = true;
	if (storePrev)
		prevIsCanvasEnabled[canvasId] = isCanvasEnabled[canvasId];
	isCanvasEnabled[canvasId] = true
	
}

function disableCanvas(canvasId, storePrev) {
	document.getElementById("overlay" + canvasId).style.display = "block";
	$('input:radio[name=canvas' + canvasId +']')[1].checked = true;

	if (storePrev)
		prevIsCanvasEnabled[canvasId] = isCanvasEnabled[canvasId];
	isCanvasEnabled[canvasId] = false

}

function resetCanvas() {
	enableCanvas(0, true);
	enableCanvas(1, true);+
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
	canvas0State = $('input[name="canvas0"]:checked').val();
	canvas1State = $('input[name="canvas1"]:checked').val();
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
	if(checkBox = document.getElementById("simreorder").checked)
		simreorder = true;
	else
		simreorder = false;
}

function setColor(checkboxId) {
	if(checkBox = document.getElementById("isColor" + checkboxId).checked) {
		isColor[checkboxId] = true;
		document.getElementById("isGray" + checkboxId).checked = false;
		isGray[checkboxId] = false;
		
	}
	else 
		isColor[checkboxId] = false;
	searchByForm();
}

function set43(checkbox) {
	if(checkBox = document.getElementById("is43").checked) {
		is43 = true;
		document.getElementById("is169").checked = false;
		is169 = false;
	}
	else
		is43 = false;
	searchByForm();
}

function set169(checkbox) {
	if(checkBox = document.getElementById("is169").checked) {
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
	var queryObj = new Object();
	queryObj.qbe = imgUrl;	
	searchByLink(queryObj);
}

function queryByTextual() {
	searchByForm();
}

function queryByCLIP() {
	searchByForm();
}

function fromIDtoColor(id, numberborderColors){ // FRANCA
	var idH= id.hashCode();
	borderColorsIdx = idH % numberborderColors;
	return borderColorsIdx;
}


String.prototype.hashCode = function(){// FRANCA
	var hash = 0;
	if (this.length == 0) return hash;
	for (j = 0; j < this.length; j++) {
		char = this.charCodeAt(j);
		hash = ((hash<<5)-hash)+char;
		hash = hash & hash; 
	}
	return hash;
}

function avs(id, url, keyframeId, isFirstCol="no") {
	if (avsMapHistory.has(keyframeId)) {
		$('#' + id).prop('checked', true);
		return;
	}
	$("#avsTitle").remove();
	if ($("#" + id).is(":checked") || isFirstCol=="toadd") {
		img = '<span id="avsList_' + id + '">';
		img += '<img title="' + keyframeId + '"style="padding-bottom: 10px;" width="90" height="72" src="' + url + '">';
		img += '<img title="remove ' + keyframeId + '" width="16" style="vertical-align: top;" src="Actions-dialog-close-icon.png" onclick="avsRemoveItem(\'' + id + '\', \'' + keyframeId + '\', true); updateAvsTitle()"/></span>'
		avsMap.set(keyframeId, id);
		//avsQueryLog.set(keyframeId, prevQuery);
		$("#avsTab").append(img);
		$("#" + id.split('avs_')[1]).css({"border-width":"12px", "border-style": "dashed"});
		
	} else {
		avsRemoveItem(id, keyframeId, true)
		$("#" + id.split('avs_')[1]).css({"border-width":"3px", "border-style": "solid"});

	}
	updateAvsTitle();
	console.log(avsMap);
}

function avsByImg(id) {
	document.getElementById('avs_' + id).checked = !document.getElementById('avs_' + id).checked;
}

function avsRemoveItem(id, keyframeId, uncheck) {
	$("#avsTitle").remove();
	$("#avsList_" + id).remove();

	avsMap.delete(keyframeId);
	if (uncheck) {
		$('#' + id).prop('checked', false);
		$("#" + id.split('avs_')[1]).css({"border-width":"1px", "border-style": "solid"});

	}		
}

function updateAvsTitle() {
	avsText = "";
	if (avsMap.size > 0 || avsMapHistory.size > 0) {
		avsText = '<div title="Selected images for AVS Tasks" id="avsTitle"><span style="color:brown; font-size: larger;">Selected: <b style="color: Coral; font-size:large;">' + avsMap.size + '</b></span><span style="color:green; font-size: larger;"> Submitted: <b style="color: red; font-size:large;">' + avsMapHistory.size + '</b></span>';
	}
	if (avsMap.size > 0) {
		avsText += '<span class="pull-left"><i title="Submit AVS image List" class="fa fa-arrow-alt-circle-up" style="font-size:36px; float: left; color:#00AA00; padding-right: 10px;" onclick="submitAVS(); return false;"></i></span></div>';
	}
	if (avsMap.size > 0 || avsMapHistory.size > 0) {
		$("#avsTab").prepend(avsText);	
	}
}

function avsSelectedCheckbox() {
	for (let pair of avsMap) {
    	var [key, value] = pair;
		$('#' + value).prop('checked', true);
		$("#" + value.split('avs_')[1]).css({"border-width":"12px", "border-style": "dashed"});

	}
	
	for (let pair of avsMapHistory) {
    	var [key, value] = pair;
		$('#' + value).prop('checked', true);
		$("#" + value.split('avs_')[1]).css({"border-width":"12px", "border-style": "dashed"});

	}
}

avsFirstCol = []
maxAVSAutoSelected = 28

function selectColToggle(i) {
	value = "toremove";
	if ($('#selectAll').is(':checked')) {
		value = "toadd";
	}
	selectedCounter = 0;
	for (avsIDX = 0; avsIDX < avsFirstCol.length && selectedCounter < maxAVSAutoSelected; avsIDX++) {
		if (avsMap.has(avsFirstCol[avsIDX].visioneID) && value == "toadd")
			continue;
		document.getElementById(avsFirstCol[avsIDX].id).checked = !document.getElementById(avsFirstCol[avsIDX].id).checked;
		avs(avsFirstCol[avsIDX].id, avsFirstCol[avsIDX].thumb, avsFirstCol[avsIDX].visioneID, value)
		selectedCounter++;
	}
}
	
function showResults(data) {
	avsFirstCol = []
	$('html,body').scrollTop(0);
	$("#imgtable").remove();
	//$('#results').scrollTop(0);
	$('#content').scrollTop(0);
	if(data == null || data == "") {
			imgtable = '<div id="imgtable" class="alert alert-danger" role="alert"> <strong>Ops!</strong> No results.';
			$("#results").append(imgtable);
	}
	else {
		var res = JSON.parse(data);
		//patch temporanea 20/07/20 per il merge
		//if (res.length > 1200)
		//	res = res.slice(0, 1200);
		if(res.length == 0 ) {
			imgtable = '<div id="imgtable" class="alert alert-danger" role="alert"> <strong>Ops!</strong> No results.';
		} 
		else {
		borderColorsIdx = 0;
		numberborderColors = borderColors.length;
		imgtable = '<div><table id="imgtable" style="text-align: left; width: 1050px;">';
		prevID = '';
		
		//imgtable += '<tr><td colspan=10><input id="selectAll" type="checkbox" onchange="selectColToggle(0)">AVS Select First Col</td></tr>';
		
		imgtable += ' <tr>';

		itemPerRow = 0;
		for (i = 0; i < res.length; i++) {
			imgId = res[i].imgId;
			score = res[i].score;
			collection = res[i].collection;
	
			resSplit = imgId.split("__");
			for (splitIdx = 0; splitIdx < resSplit.length; splitIdx++) {
				path = collection + "/" + resSplit[splitIdx];
				visioneID = resSplit[splitIdx]; 
				resValues = resSplit[splitIdx].split("/");
				videoID = resValues[0];
				if(i==0)
					imgtable += '<td style="padding-right:5px"><a href="showVideoKeyframes.jsp?collection=' + collection + '&id='+ visioneID + '" target="_blank">'+videoID +'<a>';//LUcia
				if (videoID == prevID && itemPerRow++ > 50)
					continue;
				if (itemPerRow >0 && itemPerRow%10==0) {
					imgtable += '</tr><tr>';
					imgtable += '<td></td>';//LUcia
				}
				if (prevID != "" && videoID != prevID) {
					imgtable += '</tr><tr><td class="hline" colspan=11></td></tr><tr>';
					imgtable += '<td style="padding-right:5px"><a href="showVideoKeyframes.jsp?collection=' + collection + '&id='+ visioneID + '" target="_blank">'+videoID +'<a></td>';//LUcia
					itemPerRow = 0;
				}
				idHref = resValues[1].split("\.")[0];
				nameFrame = idHref;
				borderColorsIdx = fromIDtoColor(videoID,numberborderColors ); // FRANCA
				prevID = videoID;
				urlPreview = videoshrinkUrl +"/" +videoID+".mp4";
				//urlPreview = videoUrl + "videoshrink/"+videoID+".mp4";
				nameFrame=nameFrame.replace(videoID+"_", "");  //Lucia
				if (itemPerRow == 0) {

					if (!avsMap.has(visioneID) && !avsMapHistory.has(visioneID)) {
							firstObj=new Object();
							firstObj.id = 'avs_' + idHref;
							firstObj.thumb = thumbnailUrl+ path;
							firstObj.visioneID = visioneID;
							avsFirstCol.push(firstObj);
					}

				}
				
				
				imgtable += '<td>'
					//+'<div class="thumbnailButtons">'
					+' <input style="display: none" class="checkboxAvs" id="avs_' + idHref + '" type="checkbox" title="select for AVS Task" onchange="avs(\'avs_' + idHref + '\',\'' + thumbnailUrl+ path + '\',\'' + visioneID + '\')">&nbsp;'
					+'<a style="font-size:12px;" title="' + nameFrame + ' Score: '+ score + '" href="indexedData.html?collection=' + collection + '&id='+ visioneID+ '" target="_blank">'+ nameFrame+'</a>'
					+'<a href="showVideoKeyframes.jsp?collection=' + collection + '&id='+ visioneID	+ '#'+ idHref+	'" target="_blank"><i class="fa fa-th" style="font-size:12px;  padding-left: 3px;"></i></a>'
					+'<i class="fa fa-play" style="font-size:12px; color:#007bff;padding-left: 3px;" onclick="playVideoWindow(\''+ collection+ '\', \''+ videoID+ '\', \''+visioneID+'\'); return false;"></i>'
					+'<img style="padding: 2px;" src="img/gem_icon.svg" width=20 title="image similarity" alt="' + visioneID + '" id="gemSim' + idHref + '" onclick="var queryObj=new Object(); queryObj.vf=\'' + visioneID + '\'; searchByLink(queryObj); return false;">'
					+'<img style="padding: 2px;" src="img/tern_icon.svg" width=20 title="semantic similarity" alt="' + visioneID + '" id="ternSim' + idHref + '" onclick="var queryObj=new Object(); queryObj.ternSim=\'' + visioneID + '\'; searchByLink(queryObj); return false;">'
					+'<img style="padding: 2px;" src="img/clip_icon.svg" width=20 title="semantic video similarity" alt="' + visioneID + '" id="clipSim' + '" onclick="var queryObj=new Object(); queryObj.clipSim=\'' + visioneID + '\'; searchByLink(queryObj); return false;">'
					//+'<span style="color:blue;" title="' + visioneID + '" id="ternSim' + idHref + '">tern </span>'
					//+'<span style="color:blue;" title="' + visioneID + '" id="clipSim' + idHref + '">fols </span>'
					+'<span class="pull-right"><i title="Submit result" class="fa fa-arrow-alt-circle-up" style="font-size:17px; color:#00AA00; padding-left: 0px;" onclick="submitWithAlert(\''+ visioneID+ '\'); return false;"></i></span>'

					//backgroundImg = "background-image: url('" + thumbnailUrl+ path + "')";
					//imgtable += '<div class="video" style="display:none"><video style="' + backgroundImg + '" id="videoPreview' + idHref + '" title="'+ visioneID+ '" class="myimg-thumbnail" loop preload="none"><source src="' + urlPreview + '" type="video/mp4"></video></div>'
					//imgtable += '<div class="myimg-thumbnail" style="border-color:' + borderColors[borderColorsIdx] + ';" id="'+ idHref + '" title="Search similar. score: '+ score + '" lang="'+ visioneID + '|' + urlPreview  + '">'
					//imgtable += '<div title="Left click to select, right click to play preview. Score: '+ score + '" class="myimg-thumbnail" style="border-color:' + borderColors[borderColorsIdx] + ';" id="'+ idHref + '" lang="'+ visioneID + '|' + urlPreview  + '" onclick="avsByImg(\'' + idHref +  '\'); avs(\'avs_' + idHref + '\',\'' + thumbnailUrl+ path + '\',\'' + visioneID + '\')">'
					imgtable += '<div class="myimg-thumbnail" style="border-color:' + borderColors[borderColorsIdx] + ';" id="'+ idHref + '" lang="'+ visioneID + '|' + urlPreview  + '" onclick="avsByImg(\'' + idHref +  '\'); avs(\'avs_' + idHref + '\',\'' + thumbnailUrl+ path + '\',\'' + visioneID + '\')">'
					//+'<img title="Search similar. score: '+ score + '" id="img' + idHref + '" class="myimg"  src="'+thumbnailUrl+ path + '"/>'
					+'<img id="img' + idHref + '" class="myimg"  src="'+thumbnailUrl+ path + '"/>'
					+'</div></div></td>'
	
			}
					
		}
			}
		imgtable += '</table></div>';
		$("#results").append(imgtable);
		if (res.length > 1) {
		for (i = 0; i < res.length; i++) {
			imgId = res[i].imgId;
			score = res[i].score;
			collection = res[i].collection;
	
			resSplit = imgId.split("__");
				for (splitIdx = 0; splitIdx < resSplit.length; splitIdx++) {
					//console.log(res[i + 1]);
					visioneID = resSplit[splitIdx]; 
					idHref = visioneID.split("/")[1].split("\.")[0];
					//console.log(idHref);
					/*$('#' + idHref).click(function() {
						console.log(this.id);
						var queryObj = new Object();
						queryObj.vf =  this.lang.split('|')[0];
						searchByLink(queryObj);
					});
		
					$('#ternSim' + idHref).click(function() {
						console.log(this.id);
						var queryObj = new Object();
						queryObj.ternSim =  this.alt;	
						searchByLink(queryObj);
					});					
					
					/*$('#gemSim' + idHref).click(function() {
						console.log(this.id);
						var queryObj = new Object();
						queryObj.vf =  this.alt;	
						searchByLink(queryObj);
					});
					
					$('#clipSim' + idHref).click(function() {
						console.log(this.id);
						var queryObj = new Object();
						queryObj.clipSim =  this.alt;	
						searchByLink(queryObj);
					});*/
						
				var cip = $('#' + idHref).hover( hoverVideo, hideVideo );
				
				function hoverVideo(e) {
					$('#' + this.id).contextmenu(function() {
						imgId = 'img' + this.id;
						playerId = 'video' + this.id;
						var elementExists = document.getElementById(playerId);
						collection = "v3c1";
						videourl=this.lang.split('|')[1];
						if (parseInt(this.id) > 7475)
							collection = "v3c2";
						docId = this.id.split("_")[0] + '/' + this.id + '.jpg';
						var startTime = getStartTime(docId);
						var endTime = getEndTime(docId);
						if (elementExists != null) {
							
							$('#'+ playerId).get(0).pause();
						    $('#'+ playerId).attr('src', videourl + '#t=' + startTime + ',' + endTime);
						    $('#'+ playerId).get(0).load();
							$('#'+ playerId).get(0).play();
							return;
						}
						backgroundImg = "background-image: url('" + thumbnailUrl+ collection + '/'+ docId + "')";
					
						//imgtable = '<div class="video"><video style="' + backgroundImg + '" id="' + playerId + '" title="'+ this.alt+ '" class="myimg-thumbnail" loop preload="none"><source src="' + this.title + '" type="video/mp4"></video></div>'
						//imgtable = '<video style="' + backgroundImg + '" id="' + playerId + '" title="'  + this.title + '" class="myimg video" loop muted preload="none"><source src="' + videourl + '" type="video/mp4"></video>'
						//imgtable = '<video style="' + backgroundImg + '" id="' + playerId + '" class="myimg video" loop muted preload="none"><source src="' + videourl + '" type="video/mp4"></video>'
						imgtable = '<video id="' + playerId + '" class="myimg video" autoplay loop muted preload="none"><source src="' + videourl + '#t=' + startTime + ',' + endTime + '" type="video/mp4"></video>'
						$('#' + imgId).css("display", "none");
						$('#' + this.id).append(imgtable);
						//$('#'+ playerId).get(0).currentTime = time-1;
						//$('#'+ playerId).get(0).play();
						return false;
					});

					
				}
				
				function hideVideo(e) {
					imgId = 'img' + this.id;
					playerId = 'video' + this.id;
					//$('#'+ playerId).get(0).pause(); 
					var elementExists = document.getElementById(playerId);
						if (elementExists != null) {
							$('#' + playerId).remove();
							$('#' + imgId).css("display", "block");
						}
				}
				
				}
			}
			
		}
		avsSelectedCheckbox();
	}
}
/*
function hoverVideo(id, videourl, backgroundImage) {
	$('#' + id).contextmenu(function() {
		imgId = 'img' + id;
		playerId = 'video' + id;
		var elementExists = document.getElementById(playerId);
		if (elementExists != null) {
			return
		}
		collection = "v3c1";
		if (parseInt(id) > 7475)
			collection = "v3c2";
		docId = id.split("_")[0] + '/' + id + '.jpg';
		var time = getStartTime(docId);
		backgroundImg = "background-image: url('" + backgroundImage + "')";
	
		//imgtable = '<div class="video"><video style="' + backgroundImg + '" id="' + playerId + '" title="'+ this.alt+ '" class="myimg-thumbnail" loop preload="none"><source src="' + this.title + '" type="video/mp4"></video></div>'
		//imgtable = '<video style="' + backgroundImg + '" id="' + playerId + '" title="'  + this.title + '" class="myimg video" loop muted preload="none"><source src="' + videourl + '" type="video/mp4"></video>'
		//imgtable = '<video style="' + backgroundImg + '" id="' + playerId + '" class="myimg video" loop muted preload="none"><source src="' + videourl + '" type="video/mp4"></video>'
		imgtable = '<video style="' + backgroundImg + '" id="' + playerId + '" class="myimg video" loop muted preload="none"><source src="' + videourl + '" type="video/mp4"></video>'
		$('#' + imgId).css("display", "none");
		$('#' + id).append(imgtable);
		$('#'+ playerId).get(0).currentTime = time-1;
		$('#'+ playerId).get(0).play();
	});

	
}

function hideVideo(id) {
	imgId = 'img' + id;
	playerId = 'video' + id;
	//$('#'+ playerId).get(0).pause(); 
	var elementExists = document.getElementById(playerId);
		if (elementExists != null) {
			$('#' + playerId).remove();
			$('#' + imgId).css("display", "block");
		}
}
*/
function playVideoWindowOld(collection, videoId, idHref){
  let params = `scrollbars=no,status=no,location=no,toolbar=no,menubar=no,width=600,height=600,left=50,top=50`;
  //video = videoId.split(QUERY_SPLIT);
  numTime = idHref;
  console.log("----" +videoId + " "+numTime);
  var timestamp = getStartTime(numTime);
  log("videoPlayer" + videoId + "_" + timestamp);
  input_file = videoUrl + collection.toUpperCase() + "/videos/" +videoId+"/"+videoId+".mp4#t="+timestamp;
  var myWindow = window.open(input_file, "playvideo",params);

}

function playVideoWindow(collection, videoId, idHref){
  let params = `scrollbars=no,status=no,location=no,toolbar=no,menubar=no,width=850,height=710,left=50,top=50`;
  //video = videoId.split(QUERY_SPLIT);
  numTime = idHref;
  console.log("----" +videoId + " "+numTime);
  var time = getStartTime(numTime);
  //var time = getMiddleTimestamp(numTime);
  log("videoPlayer" + videoId + "_" + time);
  //url = videoUrl + collection.toUpperCase() + "/videos/" +videoId+"/"+videoId+".mp4";
  url = videoUrl + "video480/" + "/"+videoId+".mp4";
  var myWindow = window.open("videoPlayer.html?videoid=" + videoId + "&url=" + url + "&t=" + time, "playvideo", params);

}

function generateUUID(color) {
	var d = new Date().getTime();
	if (window.performance && typeof window.performance.now === "function") {
		d += performance.now(); // use high-precision timer if available
	}
	var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,
			function(c) {
				var r = (d + Math.random() * 16) % 16 | 0;
				d = Math.floor(d / 16);
				return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
			});
	if (color)
		uuid = 'color_' + uuid;
	return uuid;
}

		$(document).on('click',".deleteBtn",function(event){
			console.log("active canvas: " + activeCanvasIdx);
			activeCanvas.getObjects().forEach(function(o) {
		        if(o.uuid === event.target.id) {
		        	activeCanvas.discardActiveObject().renderAll();
		        	activeCanvas.remove(o);
		        }
		    })
		    $("#" + event.target.id).remove();
			searchByForm();
		});

dropImage = function(e) {
	
	activeCanvas = canvas0;
	activeCanvasIdx = 0;
	var pointer = canvas1.getPointer(event.e);
	var posX = pointer.x;
	var posY = pointer.y;
	if ((posX >= 0 && posX <= widthCanvas) && (posY >= 0 && posY <= heightCanvas)) {
		activeCanvas = canvas1;
		activeCanvasIdx = 1;
	}
	
	if (draggedLabel != '') {
		scale = 16;

		var dt = e.originalEvent.dataTransfer, files = dt.files;
		e = e || window.event;
		e.preventDefault();
		e.stopPropagation();
		textVal = e.target.id;

		$('.refs').removeClass('highlight');

		if (e.target.nodeName == "CANVAS") {
			var pointer = activeCanvas.getPointer(e);
			origX = pointer.x;
			origY = pointer.y;
			var imgElement = document.getElementById(draggedLabel);
			color = imgElement.alt == 'color' ? true : false;
			if (color) {
				scale= 11;
			}
			console.log(scale + "------------------ELEMENTO " +imgElement.src)
			
			rect = new fabric.Image(imgElement, {
				left : origX - 25,
				top : origY - 30,
				fill : '',
				stroke : 'black',
				type : 'rect',
				uuid : generateUUID(color),
				strokeWidth : 1,
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

function changeQueryBySampleMod(mode) {
	if (mode == "url") {
		document.getElementById("uploadText").style.display = 'none';
		document.getElementById("uploadLink").style.display = '';
		document.getElementById("urlText").style.display = '';
		document.getElementById("urlLink").style.display = 'none';
		document.getElementById("imageToUpload").style.display = 'none';
		document.getElementById("urlToUpload").style.display = '';
		document.getElementById("imageToUpload").value = '';
		
		document.getElementById("searchbar").enctype="";
		document.getElementById("searchbar").method="GET";
	} else {
		document.getElementById("uploadText").style.display = '';
		document.getElementById("uploadLink").style.display = 'none';
		document.getElementById("urlText").style.display = 'none';
		document.getElementById("urlLink").style.display = '';
		
		document.getElementById("urlToUpload").style.display = 'none';
		document.getElementById("imageToUpload").style.display = '';
		document.getElementById("urlToUpload").value = '';
		
		document.getElementById("searchbar").enctype="multipart/form-data";
		document.getElementById("searchbar").method="POST";
	}
}

function includeHTML() {
  var z, i, elmnt, file, xhttp;
  /* Loop through a collection of all HTML elements: */
  z = document.getElementsByTagName("*");
  for (i = 0; i < z.length; i++) {
    elmnt = z[i];
    /*search for elements with a certain atrribute:*/
    file = elmnt.getAttribute("w3-include-html");
    if (file) {
      /* Make an HTTP request using the attribute value as the file name: */
      xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function() {
        if (this.readyState == 4) {
          if (this.status == 200) {elmnt.innerHTML = this.responseText;}
          if (this.status == 404) {elmnt.innerHTML = "Page not found.";}
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
	prevOccur[idx] = $('#and'+ idx).is(':checked');
	$('input:radio[name=occur' + idx +']')[0].checked = true;
	
	prevTextual[idx] = $("#textual"+ idx).val();
	$("#textual"+ idx).val('');
	
	if ($('#textualMode'+idx).is(':checked')) {
		prevTextualMode[idx] = "tern";
	}
	else
		prevTextualMode[idx] = "clip";
	$('#textualMode'+idx).prop('checked', false);

	
	prevNotField[idx] = $("#not" + idx).val();
	$("#not" + idx).val('');
	
	if ($('#isColor'+idx).is(':checked')) {
		prevIsColor[idx] = true;
	}
	else
		prevIsColor[idx] = false;
	$('#isColor'+idx).prop('checked', false);
	
	if ($('#isGray'+idx).is(':checked')) {
		prevIsGray[idx] = true;
	}
	else
		prevIsGray[idx] = false;
	$('#isGray'+idx).prop('checked', false);
	
	prevCanvasObjects[idx] = canvases[idx].getObjects();		
	
	canvases[idx].discardActiveObject().renderAll();
	canvases[idx].getObjects().forEach(function(o) {
		console.log("----> "+o.get('type'));
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

	/*
	prevIs43 = $("#is43").is(":checked");
	prevIs169 = $("#is169").is(":checked");
	prevIsColor[0] = $("#isColor0").is(":checked");
	prevIsColor[1] = $("#isColor1").is(":checked");
	prevIsGray[0] = $("#isGray0").is(":checked");
	prevIsGray[1] = $("#isGray1").is(":checked");
	prevOccur[0] = $('#and0').is(':checked');
	prevOccur[1] = $('#and1').is(':checked');
	if ($('#textualMode0').is(':checked'))
		prevTextualMode[0] = "tern";
	else
		prevTextualMode[0] = "clip";
	if ($('#textualMode1').is(':checked'))
		prevTextualMode[1] = "tern";
	else
		prevTextualMode[1] = "clip";
	prevQBE = $("#urlToUpload").val();
	console.log(prevQBE);

	prevGrouped = $("#group").is(":checked");
	prevIsCanvasEnabled[0] = isCanvasEnabled[0];
	prevIsCanvasEnabled[1] = isCanvasEnabled[1];
	prevSimreorder = simreorder;
	console.log(prevIsCanvasEnabled);
			
	$('#is43').prop('checked', false);
	$('#is169').prop('checked', false);
	$('#isColor0').prop('checked', false);
	$('#isColor1').prop('checked', false);
	$('#isGray0').prop('checked', false);
	$('#isGray1').prop('checked', false);
	$("#and0").prop("checked", true);
	$("#and1").prop("checked", true);
	$('#group').prop('checked', false);
	$('#is43').prop('checked', false);
	$('#simreorder').prop('checked', false);
	$('#urlToUpload').val('');
	$('#qbe').removeAttr("style").hide();
	
	$('#isTern0').prop('checked', true);
	$('#isTern1').prop('checked', true);

*/
	//setCanvasState(0);
}

function undoReset() {
	canvasCleanUndo(0);
	canvasCleanUndo(1);
	$('#simreorder').prop('checked', prevSimreorder);

	undoCanvas();

	/*
	$('#is43').prop('checked', prevIs43);
	$('#is169').prop('checked', prevIs169);
	$('#isColor0').prop('checked', prevIsColor[0]);				
	$('#isColor1').prop('checked', prevIsColor[1]);				
	$('#isGray0').prop('checked', prevIsGray[0]);
	$('#isGray1').prop('checked', prevIsGray[1]);
	$('#and0').prop('checked', prevOccur[0]);
	$('#and1').prop('checked', prevOccur[1]);
	if (prevTextualMode[0] == "tern")
		$('#textualMode0').prop('checked', true);
	else
		$('#textualMode0').prop('checked', false);
	if (prevTextualMode[1] == "tern")
		$('#textualMode1').prop('checked', true);
	else
		$('#textualMode1').prop('checked', false);
	$('#or0').prop('checked', !prevOccur[0]);
	$('#or1').prop('checked', !prevOccur[1]);
	$('#urlToUpload').val(prevQBE);
	console.log(prevQBE);

	$('#group').prop('checked', prevGrouped);
	$('#simreorder').prop('checked', prevSimreorder);

	console.log(prevIsCanvasEnabled);
	if (!prevIsCanvasEnabled[0])
		$('input:radio[name=canvas0]')[1].checked = true;
	if (!prevIsCanvasEnabled[1])
		$('input:radio[name=canvas1]')[1].checked = true;
		*/
	//setCanvasState(0);


}

function canvasCleanUndo(idx) {
	if (prevOccur[idx] == false)
		$('input:radio[name=occur' + idx +']')[1].checked = true;
	$("#textual" + idx).val(prevTextual[idx]);
	
	if (prevTextualMode[idx] == "tern")
		$('#textualMode'+idx).prop('checked', true);
	
	if (prevIsColor[idx] == true)
		$('#isColor'+idx).prop('checked', true);
		
	if (prevIsGray[idx] == true)
		$('#isGray'+idx).prop('checked', true);
	
	$('#or0').prop('checked', !prevOccur[0]);
	
	$("#not" + idx).val(prevNotField[idx]);
	prevCanvasObjects[idx].forEach(function(o) {
		if (o.get('type') != 'line') {
	        canvases[idx].add(o);
        	$("#" + o.get('uuid')).show();
		}
    })
}
