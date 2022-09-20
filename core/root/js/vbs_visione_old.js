
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
var prevTERN = [];
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
var prevQBE="";

const avsMap = new Map();
const avsMapHistory = new Map();
const avsQueryLog = new Map();

var tempSearchForms = 2


function handler() {
	  if (this.readyState == 4 && this.status == 200) {
		  console.log(this.responseText)
	    var myObj = JSON.parse(this.responseText);
		  urlBSService = myObj.serviceUrl;
		  thumbnailUrl= myObj.thumbnailUrl;
		  keyFramesUrl=myObj.keyFramesUrl;
		  videoUrl=myObj.videoUrl;
	  }
	  
	};
	
	
var client  = new XMLHttpRequest();
client.onload = handler;
client.open("GET", "js/conf.json", false);
client.send(); 

function playVideo(id) {
	alert(id);
	alert(getTimestamp(id + ".png"));
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

$.get('vbs_objects.csv', function(data) {
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

function getTimestamp(id) {
	return $
			.ajax({
				type : "GET",
				url :  urlBSService+"/getTimestamp?id="+ id,
				async : false
			}).responseText
}

function submitWithAlert(id, query) {
	if (confirm('Are you sure you want to submit?')) {
		res = commitResult(id, query);
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
	if (confirm('Are you sure you want to submit AVS Images?')) {
		for (let pair of avsMap) {
	    	var [keyframeId, id] = pair;
			res = commitResultAVS(keyframeId, avsQueryLog.get(keyframeId));
			console.log(res);
	
			avsRemoveItem(id, keyframeId, false);
			avsMapHistory.set(keyframeId, id);
		}
		updateAvsTitle();
	}
}

function commitResultAVS(id, queries) {
	return $.ajax({
		type : "GET",
		async : true,
		url : urlBSService+"/commitResult?id="+ id + "&isAVS=true&query=" + encodeURIComponent(queries[0]) + "&query2=" + encodeURIComponent(queries[1]) + "&simreorder=" + simreorder,
	}).responseText;
}


function commitResult(id, query) {
	return $.ajax({
		type : "GET",
		async : false,
		url : urlBSService+"/commitResult?id="+ id+ "&query=" + query,
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
	is43 = $("#is43").is(":checked");
	is169 = $("#is169").is(":checked");
	isColor[idx] = $("#isColor" + idx).is(":checked");
	isGray[idx] = $("#isGray" + idx).is(":checked");
	occur = $('input[name="occur' + idx + '"]:checked').val();
	simreorder = $("#simreorder").is(":checked");
	
	var queryObj = new Object();

	objects = '';
	txt = '';
	query = '';
	labelCounter = [];
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
				if (label.search(" ") != -1) {
					label = '(4wc'
							+ label
									.replace(new RegExp(" ", "g"),
											" OR 4wc") + ")";
					console.log("label: " + label);
				}

				if (o.uuid.startsWith('color_')) {
					colors.push(label);
				} else {
					counter = labelCounter[label];
					if (counter == null)
						counter = 1;
					else
						counter++;
					labelCounter[label] = counter;

					objects += label + counter + " ";
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
	
	tern = $("#tern" + idx).val().trim().replace(/[^\x21-\x7E]+/g, ' ');
	clip = $("#clip" + idx).val().trim().replace(/[^\x21-\x7E]+/g, ' ');

	notField = $("#not" + idx).val().trim().replace(/[^\x21-\x7E]+/g, ' ');
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
		notField = notField.replace(new RegExp(" ", "g"), ' -4wc');
		notField = '-4wc' + notField;
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

		objects = "4wc" + objects.trim().replace(new RegExp(" ", "g"), " 4wc");
		// or queries disabled
		// objects += groups;
	} else if (notField != '')
		objects = "4wc*";
	
		objects += notField;

	if (objects != '')
		queryObj.objects = objects;
	
	if (tern != '')
		queryObj.tern = tern;
		
	if (clip != '')
		queryObj.clip = clip;

	if (txt != '')
		queryObj.txt = txt;
	if (Object.keys(queryObj).length > 0)
		queryObj.occur = occur;

	console.log("Query " + queryObj);
	if (Object.keys(queryObj).length == 0)
		return null;

	return queryObj;
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
		jsonString = '{"query":[' + jsonString + ']}';
		//queryID = '{"query":[' + queryID + ']}';
		search2(jsonString);

		
	}
	else 
		$("#imgtable").remove();
}

function searchByForm() {
	queriesArr = []
	for (i = 0; i < tempSearchForms; i++) {
		if (cell2Text(i) != null)
			queriesArr.push(cell2Text(i))
	}		
	prevQuery = queriesArr;
	if(queriesArr.length > 0) {
		jsonString = JSON.stringify(queriesArr);
		jsonString = '{"query":' + jsonString + '}';
		search2(jsonString);
	}
	else 
		$("#imgtable").remove();
}

function search2(query) {

	console.log(query);

	$.ajax({
		type : "POST",
		data: {query: query, simreorder: simreorder},
		dataType : "text",
		url : urlBSService+"/search",
		success : function(data) {
			results = data;
			results = sortByVideo(data);
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
			results = sortByVideo(data);
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
			results = sortByVideo(data);
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
	if(checkBox = document.getElementById("group").checked) {
		showResults(resultsSortedByVideo);
	}
	else {
		showResults(results);
	}
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
	occur = $('input[name="occur' + canvasId + '"]:checked').val();
	console.log(occur);

	searchByForm();
}

function enableCanvas(canvasId) {
	 document.getElementById("overlay" + canvasId).style.display = "none";
	isCanvasEnabled[canvasId] = true
}

function disableCanvas(canvasId) {
	document.getElementById("overlay" + canvasId).style.display = "block";
	isCanvasEnabled[canvasId] = false

}

function setCanvasState(canvasId, radioButton) {
	canvas0State = $('input[name="canvas0"]:checked').val();
	canvas1State = $('input[name="canvas1"]:checked').val();
	if (canvas0State == "enabled") {
		enableCanvas(0);
	} else {
		disableCanvas(0);
	}
	
	if (canvas1State == "enabled") {
		enableCanvas(1);
	} else {
		disableCanvas(1);
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

function queryByTERN() {
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

function avs(id, url, keyframeId) {
	if (avsMapHistory.has(keyframeId)) {
		$('#' + id).prop('checked', true);
		return;
	}
	$("#avsTitle").remove();
	if ($("#" + id).is(":checked")) {
		img = '<span id="avsList_' + id + '">';
		img += '<img title="' + keyframeId + '"style="padding-bottom: 10px;" width="72" src="' + url + '">';
		img += '<img title="remove ' + keyframeId + '" width="16" style="vertical-align: top;" src="Actions-dialog-close-icon.png" onclick="avsRemoveItem(\'' + id + '\', \'' + keyframeId + '\', true); updateAvsTitle()"/></span>'
		avsMap.set(keyframeId, id);
		avsQueryLog.set(keyframeId, prevQuery);
		$("#avsTab").append(img);
		
	} else {
		avsRemoveItem(id, keyframeId, true)
	}
	updateAvsTitle();
	console.log(avsMap);
}

function avsRemoveItem(id, keyframeId, uncheck) {
	$("#avsTitle").remove();
	$("#avsList_" + id).remove();

	avsMap.delete(keyframeId);
	if (uncheck)
		$('#' + id).prop('checked', false);		
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
	}
	
	for (let pair of avsMapHistory) {
    	var [key, value] = pair;
		$('#' + value).prop('checked', true);
	}

}

function showResultsOld(data) {
	$('html,body').scrollTop(0);
	$("#imgtable").remove();
	if (data != null && data.trim() != "") {
		var res = JSON.parse(data);
	//patch temporanea 20/07/20 per il merge
	    if (res.length > 1200)
	        res = res.slice(0, 1200);
	    if(data.length == 0 )
	    {
	        imgtable = '<div id="imgtable" class="alert alert-danger" role="alert"> <strong>Ops!</strong> No results.';
	    }else{
	        borderColorsIdx = 0;
	        numberborderColors = borderColors.length;
	        imgtable = '<div id="imgtable" style="text-align: left; width: 1050px;">';
	        prevID = '';
	
		for (i = 0; i < res.length; i++) {
		    imgId = res[i].imgId;
			score = res[i].score;
			collection = res[i].collection;
			if (i % 10 == 0){
			    if(i == 0)
			        imgtable += ' <div class="row myrow" >';
			    else 
			        imgtable += '</div><div class="row myrow">';
			}
			resSplit = imgId.split("__");
			for (splitIdx = 0; splitIdx < resSplit.length; splitIdx++) {
				path = collection + "/" + resSplit[splitIdx];
				alt = resSplit[splitIdx]; 
				resValues = resSplit[splitIdx].split("/");
				videoID = resValues[0];
				idHref = resValues[1].split("\.")[0];
				nameFrame = idHref;
				borderColorsIdx = fromIDtoColor(videoID,numberborderColors ); // FRANCA
				prevID = videoID;

			imgtable += '<div class="col mycol">'
				+'<div class="thumbnailButtons">'
				+' <input class="checkboxAvs" id="avs_' + idHref + '" type="checkbox" title="select for AVS Task" onchange="avs(\'avs_' + idHref + '\',\'' + thumbnailUrl+ path + '\',\'' + alt + '\')">&nbsp;'
				+'<a href="indexedData.html?collection=' + collection + '&id='+ alt+ '" target="_blank">'+ nameFrame+'</a>'
				+'<a href="showVideoKeyframes.jsp?collection=' + collection + '&id='+ alt	+ '#'+ idHref+	'" target="_blank"><i class="fa fa-th" style="padding-left: 5px;"></i></a>'
				+'<i class="fa fa-play" style="color:#007bff;padding-left: 5px;" onclick="playVideoWindow(\''+ videoID+ '\', \''+alt+'\'); return false;"></i>'
				//+'<span style="color:blue;" title="' + alt + '" id="ternSim' + idHref + '">TERN </span>'
				//+'<span style="color:blue;" title="' + alt + '" id="ssr' + idHref + '">SSR </span>'
				//+'<span style="color:green;" title="' + alt + '" id="bb' + idHref + '"> BB</span>'
				//+'<span class="pull-right"><i title="Submit result" class="fa fa-arrow-alt-circle-up" style="font-size:21px; float: right; color:#00AA00; padding-left: 0px;" onclick="submitWithAlert(\''+ alt+ '\',\''+submitQuery+'\'); return false;"></i></span>'
				+ '</div><div class="myimg-thumbnail" style="border-color:' + borderColors[borderColorsIdx] + ';">'
				+'<img class="myimg"   alt="'+ alt+ '" id="'+ idHref+ '" title="Search similar. score: '+ score + '" src="'+thumbnailUrl+ path + '"/>'
				+'</div></td>'
	
		}
				
	}
		}
		imgtable += '</div>';
		$("#results").append(imgtable);
		if (res.length > 1) {
		for (i = 0; i < res.length; i++) {
			imgId = res[i].imgId;
			score = res[i].score;
			collection = res[i].collection;
	
			resSplit = imgId.split("__");
				for (splitIdx = 0; splitIdx < resSplit.length; splitIdx++) {
					console.log(res[i + 1]);
					idHref = resSplit[splitIdx].split("/")[1].split("\.")[0];
					console.log(idHref);
							$('#' + idHref).click(function() {
					console.log(this.id);
					var queryObj = new Object();
					queryObj.vf =  this.alt;	
					searchByLink(queryObj);
				});
	
				$('#ternSim' + idHref).click(function() {
					console.log(this.id);
					var queryObj = new Object();
					queryObj.ternSim =  this.title;	
					searchByLink(queryObj);
				});
				}
			}
		}
		avsSelectedCheckbox();
	
	
	}
	}
	

function hoverVideo(e) {
	imgId = 'img' + this.id;
	playerId = 'video' + this.id;
	collection = "v3c1";
	if (parseInt(this.id) > 7475)
		collection = "v3c2";
	docId = this.id.split("_")[0] + '/' + this.id + '.jpg';
	var time = getTimestamp(docId);
	$('#' + imgId).css("display", "none");
	backgroundImg = "background-image: url('" + thumbnailUrl+ collection + '/'+ docId + "')";

	//imgtable = '<div class="video"><video style="' + backgroundImg + '" id="' + playerId + '" title="'+ this.alt+ '" class="myimg-thumbnail" loop preload="none"><source src="' + this.title + '" type="video/mp4"></video></div>'
	imgtable = '<video style="' + backgroundImg + '" id="' + playerId + '" title="' + '" class="myimg video" loop muted preload="none"><source src="' + this.title + '" type="video/mp4"></video>'
	$('#' + this.id).append(imgtable);
	$('#'+ playerId).get(0).currentTime = time-2;
	$('#'+ playerId).get(0).play();
	
	
}

function hideVideo(e) {
	imgId = 'img' + this.id;
	playerId = 'video' + this.id;

	$('#' + imgId).css("display", "block");
	$('#' + playerId).remove();
	/*
	urlPreview = $('#'+ playerId).get(0).currentSrc;
	imgTable = '<img class="myimg" title="'+ urlPreview + '"  alt="'+ this.title+ '" id="'+ this.id+ '" title="Search similar. score: '+ score + '" src="'+thumbnailUrl+ path + '"/>'
	var time = getTimestamp(this.title);
	$('#'+ this.id).get(0).currentTime = time;

	$('#'+ this.id).get(0).pause(); 
	
	
	var bg = $('#'+ this.id).css('background-image');
	src = $('#'+ playerId).get(0).currentSrc;
    $('#'+ this.id).get(0).pause(); 
	$('#'+ this.id).find("source").attr("src",src);
	  $('#'+ this.id).get(0).preload="none";*/



}
	
function showResults(data) {
	$('html,body').scrollTop(0);


	$("#imgtable").remove();
	//$('#results').scrollTop(0);
	$('#content').scrollTop(0);
	if (data != null && data.trim() != "") {
		var res = JSON.parse(data);
		//patch temporanea 20/07/20 per il merge
		if (res.length > 1200)
			res = res.slice(0, 1200);
		if(data.length == 0 )
		{
			imgtable = '<div id="imgtable" class="alert alert-danger" role="alert"> <strong>Ops!</strong> No results.';
		}else{
		borderColorsIdx = 0;
		numberborderColors = borderColors.length;
		imgtable = '<div><table id="imgtable" style="text-align: left; width: 1050px;">';
		prevID = '';
		
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
				if (videoID == prevID && itemPerRow++ > 50)
					continue;
				if (itemPerRow > 0 && itemPerRow%10==0) {
					imgtable += '</tr><tr>';
				}
				if (prevID != "" && videoID != prevID) {
					imgtable += '</tr><tr><td class="hline" colspan=10></td></tr><tr>';

					itemPerRow = 0;
				}
				idHref = resValues[1].split("\.")[0];
				nameFrame = idHref;
				borderColorsIdx = fromIDtoColor(videoID,numberborderColors ); // FRANCA
				prevID = videoID;
				urlPreview = videoUrl + collection.toUpperCase() + "/videos/" +videoID+"/"+videoID+".mp4";
				

	
				imgtable += '<td>'
					//+'<div class="thumbnailButtons">'
					+' <input class="checkboxAvs" id="avs_' + idHref + '" type="checkbox" title="select for AVS Task" onchange="avs(\'avs_' + idHref + '\',\'' + thumbnailUrl+ path + '\',\'' + visioneID + '\')">&nbsp;'
					+'<a href="indexedData.html?collection=' + collection + '&id='+ visioneID+ '" target="_blank">'+ nameFrame+'</a>'
					+'<a href="showVideoKeyframes.jsp?collection=' + collection + '&id='+ visioneID	+ '#'+ idHref+	'" target="_blank"><i class="fa fa-th" style="padding-left: 2px;"></i></a>'
					+'<i class="fa fa-play" style="color:#007bff;padding-left: 2px;" onclick="playVideoWindow(\''+ collection+ '\', \''+ videoID+ '\', \''+visioneID+'\'); return false;"></i>'
					+'<span style="color:blue;" title="' + visioneID + '" id="ternSim' + idHref + '">tern </span>'
					+'<span style="color:blue;" title="' + visioneID + '" id="clipSim' + idHref + '">fols </span>'
					//+'<span style="color:blue;" title="' + visioneID + '" id="ssr' + idHref + '">SSR </span>'
					//+'<span style="color:green;" title="' + visioneID + '" id="bb' + idHref + '"> BB</span>'
					//+'</div>
					//backgroundImg = "background-image: url('" + thumbnailUrl+ path + "')";
					//imgtable += '<div class="video" style="display:none"><video style="' + backgroundImg + '" id="videoPreview' + idHref + '" title="'+ visioneID+ '" class="myimg-thumbnail" loop preload="none"><source src="' + urlPreview + '" type="video/mp4"></video></div>'
					imgtable += '<div class="myimg-thumbnail" style="border-color:' + borderColors[borderColorsIdx] + ';" title="'+ urlPreview + '" id="'+ visioneID + '" title="Search similar. score: '+ score + '">'
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
					console.log(res[i + 1]);
					visioneID = resSplit[splitIdx]; 
					idHref = visioneID.split("/")[1].split("\.")[0];
					console.log(idHref);
					$('#' + visioneID).click(function() {
						console.log(this.id);
						var queryObj = new Object();
						queryObj.vf =  this.id;	
						searchByLink(queryObj);
					});
		
					$('#ternSim' + idHref).click(function() {
						console.log(this.id);
						var queryObj = new Object();
						queryObj.ternSim =  this.title;	
						searchByLink(queryObj);
					});
					
					$('#clipSim' + idHref).click(function() {
						console.log(this.id);
						var queryObj = new Object();
						queryObj.clipSim =  this.title;	
						searchByLink(queryObj);
					});
							
				//var cip = $('#' + idHref).hover( hoverVideo, hideVideo );

				
				
				}
			}
			
		}
		avsSelectedCheckbox();
	
	
	}
	

	
	

}

function showResultsFlex(data) {
	$('html,body').scrollTop(0);
	$("#imgtable").remove();
	if (data != null && data.trim() != "") {
		var res = JSON.parse(data);
		//patch temporanea 20/07/20 per il merge
		if (res.length > 1200)
			res = res.slice(0, 1200);
		if(data.length == 0 )
		{
			imgtable = '<div id="imgtable" class="alert alert-danger" role="alert"> <strong>Ops!</strong> No results.';
		}else{
		borderColorsIdx = 0;
		numberborderColors = borderColors.length;
		imgtable = '<div>';
		prevID = '';
		
		imgtable += '<div class="flex-container">';
		itemPerRow = 0;
		for (i = 0; i < res.length; i++) {
			imgId = res[i].imgId;
			score = res[i].score;
			collection = res[i].collection;
	
			resSplit = imgId.split("__");
			for (splitIdx = 0; splitIdx < resSplit.length; splitIdx++) {
				path = collection + "/" + resSplit[splitIdx];
				alt = resSplit[splitIdx]; 
				resValues = resSplit[splitIdx].split("/");
				videoID = resValues[0];
				if (videoID == prevID && itemPerRow++ > 50)
					continue;
				if (videoID != prevID) {
					imgtable += '</div><div class="flex-container">';
					itemPerRow = 0;
				}
				idHref = resValues[1].split("\.")[0];
				nameFrame = idHref;
				borderColorsIdx = fromIDtoColor(videoID,numberborderColors ); // FRANCA
				prevID = videoID;
	
				imgtable += '<div>'
					//+'<div class="thumbnailButtons">'
					+' <input class="checkboxAvs" id="avs_' + idHref + '" type="checkbox" title="select for AVS Task" onchange="avs(\'avs_' + idHref + '\',\'' + thumbnailUrl+ path + '\',\'' + alt + '\')">&nbsp;'
					+'<a href="indexedData.html?collection=' + collection + '&id='+ alt+ '" target="_blank">'+ nameFrame+'</a>'
					+'<a href="showVideoKeyframes.jsp?collection=' + collection + '&id='+ alt	+ '#'+ idHref+	'" target="_blank"><i class="fa fa-th" style="padding-left: 5px;"></i></a>'
					+'<i class="fa fa-play" style="color:#007bff;padding-left: 5px;" onclick="playVideoWindow(\''+ collection+ '\', \''+ videoID+ '\', \''+alt+'\'); return false;"></i>'
					//+'<span style="color:blue;" title="' + alt + '" id="ternSim' + idHref + '">TERN </span>'
					//+'<span style="color:blue;" title="' + alt + '" id="ssr' + idHref + '">SSR </span>'
					//+'<span style="color:green;" title="' + alt + '" id="bb' + idHref + '"> BB</span>'
					//+'</div>
					+ '<div class="myimg-thumbnail" style="border-color:' + borderColors[borderColorsIdx] + ';">'
					+'<img class="myimg"   alt="'+ alt+ '" id="'+ idHref+ '" title="Search similar. score: '+ score + '" src="'+thumbnailUrl+ path + '"/>'
					+'</div></div>'
	
			}
					
		}
			}
		imgtable += '</div></div>';
		$("#results").append(imgtable);
		if (res.length > 1) {
		for (i = 0; i < res.length; i++) {
			imgId = res[i].imgId;
			score = res[i].score;
			collection = res[i].collection;
	
			resSplit = imgId.split("__");
				for (splitIdx = 0; splitIdx < resSplit.length; splitIdx++) {
					console.log(res[i + 1]);
					idHref = resSplit[splitIdx].split("/")[1].split("\.")[0];
					console.log(idHref);
							$('#' + idHref).click(function() {
					console.log(this.id);
					var queryObj = new Object();
					queryObj.vf =  this.alt;	
					searchByLink(queryObj);
				});
	
				$('#ternSim' + idHref).click(function() {
					console.log(this.id);
					var queryObj = new Object();
					queryObj.ternSim =  this.title;	
					searchByLink(queryObj);
				});
				}
			}
		}
		avsSelectedCheckbox();
	
	
	}
	

	
	

}

function showResultsNew(data) {
	$('html,body').scrollTop(0);
	$("#imgtable").remove();
	if (data != null && data.trim() != "") {
		var res = JSON.parse(data);
		//patch temporanea 20/07/20 per il merge
		if (res.length > 1200)
			res = res.slice(0, 1200);
		if(data.length == 0 ) {
			imgtable = '<div id="imgtable" class="alert alert-danger" role="alert"> <strong>Ops!</strong> No results.';
		}
		else {
            borderColorsIdx = 0;
            numberborderColors = borderColors.length;
            imgtable = '<div><table id="imgtable" style="text-align: left; width: 1050px;">';
            prevID = '';
                        
            rowCounter = 0;
            imgtable += 'ppp<tr id="row' + rowCounter + '">';
            $("#results").append(imgtable);
			console.log()
            imgtable = "";
            
            for (i = 0; i < res.length; i++) {
                imgId = res[i].imgId;
                score = res[i].score;
                collection = res[i].collection;
        
                resSplit = imgId.split("__");
                for (splitIdx = 0; splitIdx < resSplit.length; splitIdx++) {
                    path = collection + "/" + resSplit[splitIdx];
                    alt = resSplit[splitIdx]; 
                    resValues = resSplit[splitIdx].split("/");
                    videoID = resValues[0];
                    if (videoID != prevID) {
                        imgtable += '</tr>';
						tmp = rowCounter;

                        imgtable += '<tr><td><hr></td></tr><tr id="row' + ++rowCounter + '">';


                        $('#row' + tmp).append(imgtable);
            			imgtable = "";

                    }
                    idHref = resValues[1].split("\.")[0];
                    nameFrame = idHref;
                    borderColorsIdx = fromIDtoColor(videoID,numberborderColors ); // FRANCA
                    prevID = videoID;   
        
                    imgtable += '<td>'
                        +' <input class="checkboxAvs" id="avs_' + idHref + '" type="checkbox" title="select for AVS Task" onchange="avs(\'avs_' + idHref + '\',\'' + thumbnailUrl+ path + '\',\'' + alt + '\')">&nbsp;'
                        +'<a href="indexedData.html?collection=' + collection + '&id='+ alt+ '" target="_blank">'+ nameFrame+'</a>'
                        +'<a href="showVideoKeyframes.jsp?collection=' + collection + '&id='+ alt	+ '#'+ idHref+	'" target="_blank"><i class="fa fa-th" style="padding-left: 5px;"></i></a>'
                        +'<i class="fa fa-play" style="color:#007bff;padding-left: 5px;" onclick="playVideoWindow(\''+ videoID+ '\', \''+alt+'\'); return false;"></i>'
                        //+'<span style="color:blue;" title="' + alt + '" id="ternSim' + idHref + '">TERN </span>'
                        + '<div class="myimg-thumbnail" style="border-color:' + borderColors[borderColorsIdx] + ';">'
                        +'<img class="myimg"   alt="'+ alt+ '" id="'+ idHref+ '" title="Search similar. score: '+ score + '" src="'+thumbnailUrl+ path + '"/>'
                        +'</div></td>'
                }
                        
            }
		}
		imgtable += '</table></div>';
		$('#row' + rowCounter).append(imgtable);
		if (res.length > 1) {
		for (i = 0; i < res.length; i++) {
			imgId = res[i].imgId;
			score = res[i].score;
			collection = res[i].collection;
	
			resSplit = imgId.split("__");
				for (splitIdx = 0; splitIdx < resSplit.length; splitIdx++) {
					console.log(res[i + 1]);
					idHref = resSplit[splitIdx].split("/")[1].split("\.")[0];
					console.log(idHref);
							$('#' + idHref).click(function() {
					console.log(this.id);
					var queryObj = new Object();
					queryObj.vf =  this.alt;	
					searchByLink(queryObj);
				});
	
				$('#ternSim' + idHref).click(function() {
					console.log(this.id);
					var queryObj = new Object();
					queryObj.ternSim =  this.title;	
					searchByLink(queryObj);
				});
				}
			}
		}
		avsSelectedCheckbox();
	}
}

function playVideoWindowOld(collection, videoId, idHref){
  let params = `scrollbars=no,status=no,location=no,toolbar=no,menubar=no,width=600,height=600,left=50,top=50`;
  //video = videoId.split(QUERY_SPLIT);
  numTime = idHref;
  console.log("----" +videoId + " "+numTime);
  var timestamp = getTimestamp(numTime);
  log("videoPlayer" + videoId + "_" + timestamp);
  input_file = videoUrl + collection.toUpperCase() + "/videos/" +videoId+"/"+videoId+".mp4#t="+timestamp;
  var myWindow = window.open(input_file, "playvideo",params);

}

function playVideoWindow(collection, videoId, idHref){
  let params = `scrollbars=no,status=no,location=no,toolbar=no,menubar=no,width=660,height=540,left=50,top=50`;
  //video = videoId.split(QUERY_SPLIT);
  numTime = idHref;
  console.log("----" +videoId + " "+numTime);
  var time = getTimestamp(numTime);
  log("videoPlayer" + videoId + "_" + time);
  url = videoUrl + collection.toUpperCase() + "/videos/" +videoId+"/"+videoId+".mp4";
  var myWindow = window.open("videoPlayer.html?url=" + url + "&t=" + time, "playvideo", params);

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
	prevTERN[idx] = $("#tern"+ idx).val();
	prevCLIP[idx] = $("#clip"+ idx).val();
	prevNotField[idx] = $("#not" + idx).val();
	
	$("#tern" + idx).val('');
	$("#clip" + idx).val('');
	$("#not" + idx).val('');
	
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
	prevIs43 = $("#is43").is(":checked");
	prevIs169 = $("#is169").is(":checked");
	prevIsColor[0] = $("#isColor0").is(":checked");
	prevIsColor[1] = $("#isColor1").is(":checked");
	prevIsGray[0] = $("#isGray0").is(":checked");
	prevIsGray[1] = $("#isGray1").is(":checked");
	prevOccur[0] = $('#and0').is(':checked');
	prevOccur[1] = $('#and1').is(':checked');
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
	
	$('input:radio[name=canvas0]')[0].checked = true;
	$('input:radio[name=canvas1]')[0].checked = true;

	setCanvasState(0, this);

}

function undoReset() {
	canvasCleanUndo(0);
	canvasCleanUndo(1);
	$('#is43').prop('checked', prevIs43);
	$('#is169').prop('checked', prevIs169);
	$('#isColor0').prop('checked', prevIsColor[0]);				
	$('#isColor1').prop('checked', prevIsColor[1]);				
	$('#isGray0').prop('checked', prevIsGray[0]);
	$('#isGray1').prop('checked', prevIsGray[1]);
	$('#and0').prop('checked', prevOccur[0]);
	$('#and1').prop('checked', prevOccur[1]);
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
	setCanvasState(0, this);

}

function canvasCleanUndo(idx) {
	$("#tern" + idx).val(prevTERN[idx]);
	$("#clip" + idx).val(prevCLIP[idx]);
	$("#not" + idx).val(prevNotField[idx]);
	prevCanvasObjects[idx].forEach(function(o) {
		if (o.get('type') != 'line') {
	        canvases[idx].add(o);
        	$("#" + o.get('uuid')).show();
		}
    })
}

var cip = $(".video").hover( hoverVideo, hideVideo );

function hoverVideo(e) {  
    $('video', this).get(0).play(); 
}

function hideVideo(e) {
    $('video', this).get(0).pause(); 
}
