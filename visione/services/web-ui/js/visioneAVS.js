const avsManually = new Map();
const avsManuallyByVideoID = new Map();
const avsSubmitted = new Map();

/*
function getAvsObj(videoId, imgId, avsTagId, thumb, keyframe, rowIdx, colIdx) {
	avsObj=new Object();
	avsObj.videoId = videoId;
	avsObj.imgId = imgId;
	avsObj.avsTagId = avsTagId;
	avsObj.thumb = thumb;
	avsObj.keyframe = keyframe;
	avsObj.rowIdx = rowIdx;
	avsObj.colIdx = colIdx;
	return avsObj
}*/

/*
function submitAVS(selectedItem) {
	$('#submitted_bar').css("display", "block");
	let res = null;
	if (!isAVS)
		res = submitResult(selectedItem.imgId, selectedItem.videoId);
	else
		submitResult(selectedItem.imgId, selectedItem.videoId);
	avsRemoveSelected(selectedItem)

	updateAVSTab(selectedItem)
	avsSubmitted.set(selectedItem.videoId, selectedItem);
	avsSubmittedTab(selectedItem);
	if (!isAVS) {
		alert('Server response: ' + res);
	}
	$( "#submitted_num" ).text(avsSubmitted.size)
	updateAVSInfo();
	avsHilightlighSubmittedVideos();
}*/

const imgSelected = (selectedItem, videoUrl, videoUrlPreview, img_loading="eager") => {
	selectedString = JSON.stringify(selectedItem);

	return `
		<span id="avsList_${selectedItem.imgId}">
			<div style="float: left; padding: 2px;">
				<img id="remove_${selectedItem.imgId}" style="padding-left: 5px;" title="remove ${selectedItem.imgId}" width="30" src="img/Actions-dialog-close-icon.png" onclick='avsToggle(${JSON.stringify(selectedItem)}, null, true)'>
				<a style="font-size:12px; padding-left: 5px;" title="View annotations of ${selectedItem.imgId}" href="indexedData.html?videoId=${selectedItem.videoId}&id=${selectedItem.imgId}" target="_blank">${selectedItem.imgId}</a>
				<a title="Video summary" href="showVideoKeyframes.html?videoId=${selectedItem.videoId}&id=${selectedItem.imgId}#${selectedItem.imgId}" target="_blank"><i class="fa fa-th" style="font-size:12px;  padding-left: 5px;"></i></a>
				<a href="#" title="Play Video"><i title="Play Video" class="fa fa-play font-normal" style="color:#007bff;padding-left: 3px;" onclick="playVideoWindow('${videoUrl}', '${selectedItem.videoId}', '${selectedItem.imgId}'); return false;"></i></a>
				<a href="#" title="Visual similarity"><img loading="${img_loading}" style="padding: 2px;" src="img/comboSim.svg" width=20 title="Visual similarity" alt="${selectedItem.imgId}" id="comboSim${selectedItem.imgId}" onclick="var queryObj=new Object(); queryObj.vf='${selectedItem.imgId}'; searchByLink(queryObj); return false;"></a>
				<a href="#" title="Submit result"><span class="pull-right"><i title="Submit result" class="fa fa-arrow-alt-circle-up font-huge" style="color:#00AA00; padding-left: 0px;" onclick='submitVersion2(${selectedString});'> </i></span></a>

				<br>
				<div id="avsdiv_${selectedItem.imgId}" lang="${selectedItem.videoId}|${videoUrlPreview}" style="height: 25em;">
					<img id="selected_avs_${selectedItem.imgId}" title="${selectedItem.imgId}" style="padding-bottom: 10px; height: 25em;" src="${selectedItem.keyframe}">
				</div>
			</div>
		</span>
	`
}

function selectImg(selectedItem) {
	let videoUrl = videoUrlPrefix + selectedItem.videoId + "-medium.mp4";
	let videoUrlPreview = videoshrinkUrl + selectedItem.videoId + "-tiny.mp4";
	//let id = selectedItem.imgId.replaceAll(".jpg", "");
	/*let img = '<span id="avsList_' + selectedItem.imgId + '">'

	img += '<div style="float: left; padding: 2px;">'
			+'<img id="remove_' + selectedItem.imgId + '"  style="padding-left: 5px;" title="remove ' + selectedItem.imgId + '" width="30" src="img/Actions-dialog-close-icon.png" onclick=\'avsToggle(' + JSON.stringify(selectedItem)  + ', null, true)\'>'

			+'<a style="font-size:12px; padding-left: 5px;" title="View annotations of ' + selectedItem.imgId  + '" href="indexedData.html?videoId=' + selectedItem.videoId + '&id='+ selectedItem.imgId+ '" target="_blank">'+ id+'</a>'
			+'<a title="Video summary" href="showVideoKeyframes.html?videoId=' + selectedItem.videoId + '&id='+ selectedItem.imgId + '#'+ selectedItem.imgId + '" target="_blank"><i class="fa fa-th" style="font-size:12px;  padding-left: 5px;"></i></a>'
			+'<i title="Play Video" class="fa fa-play" style="font-size:12px; color:#007bff;padding-left: 5px;" onclick="playVideoWindow(\''+ videoUrl + '\', \''+ selectedItem.videoId+ '\', \''+selectedItem.imgId+'\'); return false;"></i>'
			+'<img style="padding-left: 5px;" src="img/gem_icon.svg" width=20 title="image similarity" alt="' + selectedItem.imgId + '" id="avs_comboSim'+ selectedItem.imgId + '" onclick="var queryObj=new Object(); queryObj.comboVisualSim=\'' + selectedItem.imgId + '\'; searchByLink(queryObj); return false;">'
			+'<i title="Submit result" class="fa fa-arrow-alt-circle-up" style="font-size:17px; color:#00AA00; padding-left: 5px;" onclick="submitVersion2(${selectedItem});selectNextResult();"></i>'

			+'<br>'
			+'<div id="avsdiv_' + selectedItem.imgId + '" lang="' + selectedItem.videoId + '|' + videoUrlPreview  + '" style="height: 25em;">'
			+'<img id="selected_avs_' + selectedItem.imgId + '" title="' + selectedItem.imgId + '" style="padding-bottom: 10px; height: 25em;" src="' + selectedItem.keyframe + '">'
			+'</div></div></span>'
			*/
	let img = imgSelected(selectedItem, videoUrl, videoUrlPreview)
	$("#avsTab").append(img);

	let avsTagId = document.getElementById(selectedItem.avsTagId);
	if (avsTagId != null)
		avsTagId.checked = true;

	let selImgId = document.getElementById(selectedItem.imgId)
	if (selImgId != null) {
		selImgId.style.borderWidth = "6px";
		selImgId.style.borderStyle = "dashed";
	}

	let imgId4Regex = selectedItem.imgId.replaceAll(".", "\\.")

	var cip = $("#avsdiv_" + imgId4Regex).hover( hoverVideoAVS, hideVideoAVS );

	function hoverVideoAVS(e) {
		let avsdivNoRegex = this.id
		let avsdiv = avsdivNoRegex.replaceAll(".", "\\.")
		let imgIdNoRegex = avsdivNoRegex.replaceAll("avsdiv_", "selected_avs_")
		let imgId = imgIdNoRegex.replaceAll(".", "\\.")
		let imgIdAVS = avsdivNoRegex.replaceAll("avsdiv_", "")

		$('#' + imgId).contextmenu(function() {
			let langInfo = document.getElementById(avsdivNoRegex).lang.split('|');

			let videoId = langInfo[0];
			let videourl = langInfo[1];
			let playerId = 'video' + videoId;

			var elementExists = document.getElementById(playerId);

			var middleTime = getMiddleTimestamp(imgIdAVS);
			var startTime = middleTime -2;
			var endTime = middleTime+2;
			if (elementExists != null) {
				var player = $('#' + playerId).get(0);
				player.pause();
				player.src = videourl + '#t=' + startTime + ',' + endTime;
				player.load();
				player.play();
				return;
			}
			let backgroundImg = "background-image: url('" + thumbnailUrl + '/'+ imgIdNoRegex + "')";

			let imgtable = '<video id="' + playerId + '" class="myimg video" autoplay loop muted preload="none"><source src="' + videourl + '#t=' + startTime + ',' + endTime + '" type="video/mp4"></video>'
			$('#' + avsdiv).append(imgtable);
			$('#' + imgId).css("display", "none");

			return false;
		});
	}

	function hideVideoAVS(e) {
		let avsdivNoRegex = this.id
		let avsdiv = avsdivNoRegex.replaceAll(".", "\\.")
		let imgId = avsdiv.replaceAll("avsdiv_", "selected_avs_")
		let langInfo = document.getElementById(avsdivNoRegex).lang.split('|');
		let videoId = langInfo[0];
		let videourl = langInfo[1];
		let playerId = 'video' + videoId;

		var elementExists = document.getElementById(playerId);
		if (elementExists != null) {
			$('#' + playerId).remove();
			$('#' + imgId).css("display", "block");
		}
	}
}

function unselectImg(selectedItem) {
	var avsListElement = document.getElementById("avsList_" + selectedItem.imgId);
	if (avsListElement) {
	  avsListElement.remove();
	}

	var avsTagElement = document.getElementById(selectedItem.avsTagId);
	if (avsTagElement) {
	  avsTagElement.checked = false;
	}

	var imgElement = document.getElementById(selectedItem.imgId);
	if (imgElement) {
	  imgElement.style.borderWidth = "3px";
	  imgElement.style.borderStyle = "solid";
	}
}

function updateAVSInfo() {
	var divAvsSelected = document.getElementById('avsSelected');
	var divResGrid = document.getElementById('resGrid');
	var divAvsSelectedHeight = divAvsSelected.offsetHeight;

	divResGrid.style.height = "calc(100% - " + divAvsSelectedHeight + "px)";
}

function updateAVSTab(selectedItem) {
	if (avsManually.has(selectedItem.imgId)) {
			selectImg(selectedItem)
	}
	else {
		unselectImg(selectedItem)
	}
	updateAVSInfo();
}

function avsToggle(avsJSON, event, isRemoveButton = false) {
	var selectedItem = avsJSON;
	rowIdx = selectedItem.rowIdx
	colIdx = selectedItem.colIdx



	//selectedItem = JSON.parse(avsJSON);
	//var avsItem = document.getElementById(selectedItem.avsTagId);
	//var isChecked = avsItem && avsItem.checked;
	if ((avsManuallyByVideoID.has(selectedItem.videoId) && event != null) || isRemoveButton) {
		//let manuallySelectedToRemove = avsManuallyByVideoID.get(selectedItem.videoId);
		avsManually.delete(selectedItem.imgId);
		avsManuallyByVideoID.delete(selectedItem.videoId);
		//avsManuallyRemoved.set(selectedItem.imgId, selectedItem)

		//updateAVSTab(manuallySelectedToRemove);
	} else {
		avsManuallyByVideoID.clear();
		avsManually.clear();
		avsManually.set(selectedItem.imgId, selectedItem);
		avsManuallyByVideoID.set(selectedItem.videoId, selectedItem);
	}
	try {
		updateAVSTab(selectedItem);
		if (avsManuallyByVideoID.has(selectedItem.videoId))
			scrollToRow(rowIdx-1);
		else
			unscrollToRow(rowIdx-1);
	} catch (error) {
		console.log(error);
	}

/*

	if (event && event.ctrlKey) {
		submitAVS(selectedItem);
	}*/

}

/*
function avsRemoveSelected(selectedItem) {
	if (!avsSubmitted.has(selectedItem.videoId)) {
		if (avsManually.has(selectedItem.imgId)) {
			avsManually.delete(selectedItem.imgId);
			avsManuallyByVideoID.delete(selectedItem.videoId);
		}
	}
}*/

function avsSubmittedTab(selectedItem) {
	videoUrl = videoUrlPrefix + selectedItem.videoId + "-medium.mp4";
	//let id = selectedItem.imgId;.replaceAll(".jpg", "");

	img = '<div id="avsSubmittedList_' + selectedItem.imgId + '">';

	img += '<a title="View annotations of ' + selectedItem.imgId  + '" href="showVideoKeyframes.html?videoId=' + selectedItem.videoId + '&id='+ selectedItem.imgId + '#'+ selectedItem.imgId + '" target="_blank"><i class="fa fa-th" style="font-size:12px;  padding-left: 3px;"></i></a>'
			+'<a href="#"><i title="Play Video" class="fa fa-play" style="font-size:10px; color:#007bff;padding-left: 3px;" onclick="playVideoWindow(\''+ videoUrl+ '\', \''+ selectedItem.videoId+ '\', \''+selectedItem.imgId+'\'); return false;"></i><a>'
			+'<a href="#"><img style="padding-left: 5px;" src="img/comboSim.svg" width=20 title="Visual similarity" alt="' + selectedItem.imgId + '" id="avs_comboSim'+ selectedItem.imgId + '" onclick="var queryObj=new Object(); queryObj.comboVisualSim=\'' + selectedItem.imgId + '\'; searchByLink(queryObj); return false;"><a>'
			+'<br>'


	img += '<img title="' + selectedItem.imgId + '"style="padding-bottom: 10px;" width="110" height="80" src="' + selectedItem.thumb + '"></div>';
	$("#avsSubmittedTab").append(img);
}

function qaSubmittedTab(answerTxt) {
	text = '<div>';

	text += '<p>' + answerTxt + '</p>'
		+'</div><br>'
	$("#avsSubmittedTab").append(text);
}

function avsHideSubmittedVideos() {
	for (let [videoId, selectedItem] of avsSubmitted) {
		tmp = $("[id^=video_" + videoId + "]");
		tmp2 = document.getElementById("video_" + videoId);
		$("[data-videoid^=" + videoId + "]").remove();
	}
}

function avsHilightlighSubmittedVideos() {
	for (let [videoId, selectedItem] of avsSubmitted) {
		tmp = $("[id^=video_" + videoId + "]");
		tmp2 = document.getElementById("video_" + videoId);
		$("[data-videoid^=" + videoId + "]").css("background-color", "#fce390");
	}
}


function avsCleanManuallySelected() {
	for (let [key, selectedItem] of avsManually) {
		unselectImg(selectedItem)
	}
}

/*
function avsReloadManuallySelected() {
	for (let [key, selectedItem] of avsManually) {
		try {
			updateAVSTab(selectedItem)
		} catch (error) {
			console.log("AVS " + selectedItem.imgId + " is not in the results list");
		}
	}
}*/
