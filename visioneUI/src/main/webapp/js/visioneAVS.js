const avsAuto = new Map();
const avsManual = new Map();
const avsSubmitted = new Map();

avsAutoSelected = []
maxAutoSelected = 3


function getAvsObj(collection, videoId, imgId, avsTagId, thumb) {
	avsObj=new Object();
	avsObj.collection = collection;
	avsObj.videoId = videoId;
	avsObj.imgId = imgId;
	avsObj.avsTagId = avsTagId;
	avsObj.thumb = thumb;
	return JSON.stringify(avsObj) 
}

function addToAutoSelected(avsJSON) {
	const avsObj = JSON.parse(avsJSON);
	avsAutoSelected.push(avsObj);
}

function submitAVS() {
	$('#submitted_bar').css("display", "block");
	for (let [key, selectedItem] of avsAuto) {
		//res = submitResultAVS(keyframeId, avsQueryLog.get(keyframeId));
		res = submitToServer(selectedItem.imgId);
		avsRemoveSelected(selectedItem)
		updateAVSTab(selectedItem)
		avsSubmitted.set(selectedItem.videoId,selectedItem);
		avsSubmittedTab(selectedItem);

	}

	for (let [key, selectedItem] of avsManual) {
		//res = submitResultAVS(keyframeId, avsQueryLog.get(keyframeId));
		res = submitToServer(selectedItem.imgId);
		avsRemoveSelected(selectedItem)
		updateAVSTab(selectedItem)
		avsSubmitted.set(selectedItem.videoId, selectedItem);
		avsSubmittedTab(selectedItem);

	}
	$( "#submitted_num" ).text(avsSubmitted.size)
	updateAVSInfo();
	avsHideSubmittedVideos();
}

function submitToServer(imgId) {
	return $.ajax({
		type: "GET",
		async: true,
		url: urlBSService + "/submitResult?id=" + imgId + "&isAVS=true&simreorder=" + simreorder,
	}).responseText;
}

function selectImg(selectedItem) {
	videoUrl = videoUrlPrefix +selectedItem.videoId+".mp4";

	img = '<span id="avsList_' + selectedItem.imgId + '">'
	
	img += '<div style="float: left; padding: 2px;"><a style="font-size:12px; padding-left: 2px;" title="' + selectedItem.imgId  + '" href="indexedData.html?collection=' + selectedItem.collection + '&videoId=' + selectedItem.videoId + '&id='+ selectedItem.imgId+ '" target="_blank">'+ selectedItem.videoId+'</a>'
			+'<a href="showVideoKeyframes.html?collection=' + selectedItem.collection + '&videoId=' + selectedItem.videoId + '&id='+ selectedItem.imgId + '#'+ selectedItem.imgId + '" target="_blank"><i class="fa fa-th" style="font-size:12px;  padding-left: 3px;"></i></a>'
			+'<i class="fa fa-play" style="font-size:12px; color:#007bff;padding-left: 3px;" onclick="playVideoWindow(\''+ videoUrl + '\', \''+ selectedItem.videoId+ '\', \''+selectedItem.imgId+'\'); return false;"></i>'
			+ '<img style="float: right; padding: 1px;" title="remove ' + selectedItem.imgId + '" width="20" src="img/Actions-dialog-close-icon.png" onclick=\'avsToggle(' + JSON.stringify(selectedItem)  + ')\'>'

			+'<br>'
			+ '<img title="' + selectedItem.imgId + '"style="padding-bottom: 10px;" width="145" height= "90" src="' + selectedItem.thumb + '">'
		$("#avsTab").append(img);
		
			if (document.getElementById(selectedItem.avsTagId) != null)
		document.getElementById(selectedItem.avsTagId).checked = true;
	if (document.getElementById(selectedItem.imgId) != null) {
		document.getElementById(selectedItem.imgId).style.borderWidth = "12px";
		document.getElementById(selectedItem.imgId).style.borderStyle = "dashed";
	}
		
		/*
		
		var cip = $('#' + "avsList_" + selectedItem.imgId).hover( hoverVideo, hideVideo );
		
		function hoverVideo(e) {
			id4Regex = this.id.replaceAll("/", "\\/").replaceAll(".", "\\.")
			$('#' + id4Regex).contextmenu(function() {
				imgId = 'img' + id4Regex;
				langInfo = this.lang.split('|');
				collection = langInfo[0];
				videoId = langInfo[1];
				videourl=langInfo[2];
				playerId = 'video' + videoId;

				var elementExists = document.getElementById(playerId);

				var startTime = getStartTime(this.id);
				var endTime = getEndTime(this.id);
				if (elementExists != null) {
					console.log(playerId)
					$('#'+ playerId).get(0).pause();
				    $('#'+ playerId).attr('src', videourl + '#t=' + startTime + ',' + endTime);
				    $('#'+ playerId).get(0).load();
					$('#'+ playerId).get(0).play();
					return;
				}
				backgroundImg = "background-image: url('" + thumbnailUrl+ collection + '/'+ this.id + "')";
			
				//imgtable = '<div class="video"><video style="' + backgroundImg + '" id="' + playerId + '" title="'+ this.alt+ '" class="myimg-thumbnail" loop preload="none"><source src="' + this.title + '" type="video/mp4"></video></div>'
				//imgtable = '<video style="' + backgroundImg + '" id="' + playerId + '" title="'  + this.title + '" class="myimg video" loop muted preload="none"><source src="' + videourl + '" type="video/mp4"></video>'
				//imgtable = '<video style="' + backgroundImg + '" id="' + playerId + '" class="myimg video" loop muted preload="none"><source src="' + videourl + '" type="video/mp4"></video>'
				imgtable = '<video id="' + playerId + '" class="myimg video" autoplay loop muted preload="none"><source src="' + videourl + '#t=' + startTime + ',' + endTime + '" type="video/mp4"></video>'
				$('#' + imgId).css("display", "none");
				$('#' + id4Regex).append(imgtable);
				//$('#'+ playerId).get(0).currentTime = time-1;
				//$('#'+ playerId).get(0).play();
				return false;
			});

					
		}
				
		function hideVideo(e) {
			console.log("hide")
			id4Regex = this.id.replaceAll("/", "\\/").replaceAll(".", "\\.")

			imgId = 'img' + id4Regex;
			langInfo = this.lang.split('|');
			collection = langInfo[0];
			videoId = langInfo[1];
			videourl=langInfo[2];
			playerId = 'video' + videoId;
			console.log(playerId)

			var elementExists = document.getElementById(playerId);
			console.log(elementExists)
				if (elementExists != null) {
					$('#' + playerId).remove();
					$('#' + imgId).css("display", "block");
				}
		}*/	
}

function unselectImg(selectedItem) {
	if (document.getElementById("avsList_" + selectedItem.imgId) != null) {
		document.getElementById("avsList_" + selectedItem.imgId).remove();
		unselectImg(selectedItem)
	}
	if (document.getElementById(selectedItem.avsTagId) != null)
		document.getElementById(selectedItem.avsTagId).checked = false;
	if (document.getElementById(selectedItem.imgId) != null) {
		document.getElementById(selectedItem.imgId).style.borderWidth = "3px";
		document.getElementById(selectedItem.imgId).style.borderStyle = "solid";
	}
}

function updateAVSInfo() {
	$("#avsInfo").remove();
	avsText = "";
	selectedSize = avsAuto.size + avsManual.size
	if (avsAuto.size > 0 || avsSubmitted.size > 0 || avsManual.size > 0) {
		avsText = '<div title="Selected images for AVS Tasks" id="avsInfo"><span style="color:brown; font-size: larger;">Selected: <b style="color: Coral; font-size:large;">' + selectedSize + '</b></span><span style="color:green; font-size: larger;"> Submitted: <b style="color: red; font-size:large;">' + avsSubmitted.size + '</b></span>';
		if (avsAuto.size > 0 || avsManual.size > 0) {
			avsText += '<span class="pull-left"><i title="Submit AVS image List" class="fa fa-arrow-alt-circle-up" style="font-size:36px; float: left; color:#00AA00; padding-right: 10px;" onclick="submitAVS(); return false;"></i></span></div>';
		}
		$("#avsTab").prepend(avsText);
	}
}

function updateAVSTab(selectedItem) {
	if (avsSubmitted.has(selectedItem.videoId)) {
		return;
	}
	else if (avsManual.has(selectedItem.imgId) || avsAuto.has(selectedItem.imgId)) {
		selectImg(selectedItem)
	}
	else {
		unselectImg(selectedItem)
	}
	updateAVSInfo();
}

function avsToggle(selectedItem) {
	//selectedItem = JSON.parse(avsJSON);
	isChecked = document.getElementById(selectedItem.avsTagId).checked;
	if (!isChecked)
		avsManual.set(selectedItem.imgId, selectedItem);
	else {
		if (avsManual.has(selectedItem.imgId))
			avsManual.delete(selectedItem.imgId);
		else 
			if (avsAuto.has(selectedItem.imgId))
				avsAuto.delete(selectedItem.imgId);
	}
	updateAVSTab(selectedItem);
}

function avsRemoveSelected(selectedItem) {
	if (!avsSubmitted.has(selectedItem.videoId)) {
		if (avsManual.has(selectedItem.imgId))
			avsManual.delete(selectedItem.imgId);
		else if (avsAuto.has(selectedItem.imgId))
			avsAuto.delete(selectedItem.imgId);
	}
}

function avsAddAutoselected() {
	selectedCounter = 0;
	for (avsIDX = 0; avsIDX < avsAutoSelected.length && selectedCounter < maxAutoSelected; avsIDX++) {
		if (avsManual.has(avsAutoSelected[avsIDX].imgId || avsSubmitted.has(avsAutoSelected[avsIDX].videoId)))
			continue;
		avsAuto.set(avsAutoSelected[avsIDX].imgId, avsAutoSelected[avsIDX]);
		updateAVSTab(avsAutoSelected[avsIDX])
		selectedCounter++;
	}
}

function avsRemoveAutoselected() {
	selectedCounter = 0;
	for (let [key, selectedItem] of avsAuto) {
		if (avsManual.has(selectedItem.imgId))
			continue;
		avsAuto.delete(selectedItem.imgId);
		updateAVSTab(selectedItem)
	}
}

function avsSubmittedTab(selectedItem) {
	videoUrl = videoUrlPrefix + selectedItem.videoId+".mp4";
	
	img = '<div id="avsSubmittedList_' + selectedItem.imgId + '">';
	
	
	img += '<a style="font-size:12px;" title="' + selectedItem.imgId  + '" href="indexedData.html?collection=' + selectedItem.collection + '&videoId=' + selectedItem.videoId + '&id='+ selectedItem.imgId+ '" target="_blank">'+ selectedItem.videoId+'</a>'
			+'<a href="showVideoKeyframes.html?collection=' + selectedItem.collection + '&videoId=' + selectedItem.videoId + '&id='+ selectedItem.imgId + '#'+ selectedItem.imgId + '" target="_blank"><i class="fa fa-th" style="font-size:12px;  padding-left: 3px;"></i></a>'
			+'<i class="fa fa-play" style="font-size:12px; color:#007bff;padding-left: 3px;" onclick="playVideoWindow(\''+ videoUrl+ '\', \''+ selectedItem.videoId+ '\', \''+selectedItem.imgId+'\'); return false;"></i>'
			+'<img style="padding: 2px;" src="img/gem_icon.svg" width=20 title="image similarity" alt="' + selectedItem.imgId + '" id="gemSim' + selectedItem.imgId + '" onclick="var queryObj=new Object(); queryObj.vf=\'' + selectedItem.imgId + '\'; searchByLink(queryObj); return false;">'
			+'<img style="padding: 2px;" src="img/tern_icon.svg" width=20 title="semantic similarity" alt="' + selectedItem.imgId + '" id="ternSim' + selectedItem.imgId + '" onclick="var queryObj=new Object(); queryObj.ternSim=\'' + selectedItem.imgId + '\'; searchByLink(queryObj); return false;">'
			+'<img style="padding: 2px;" src="img/clip_icon.svg" width=20 title="semantic video similarity" alt="' + selectedItem.imgId + '" id="clipSim' + '" onclick="var queryObj=new Object(); queryObj.clipSim=\'' + selectedItem.imgId + '\'; searchByLink(queryObj); return false;">'
			+'<br>'
	
	
	img += '<img title="' + selectedItem.imgId + '"style="padding-bottom: 10px;" width="110" height="80" src="' + selectedItem.thumb + '"></div>';
	$("#avsSubmittedTab").append(img);
}

function avsHideSubmittedVideos() {
	for (let [videoId, selectedItem] of avsSubmitted) {
		$("[id^=video_" + videoId + "]").remove();
		//document.getElementById("video_" + videoId).style.display = 'none';
		
	}
}



function avsCleanManualSelected() {
	for (let [key, selectedItem] of avsManual) {
		//updateAVSTab(id, null, keyframeId)
		unselectImg(selectedItem)
	}
}

function avsReloadManualSelected() {
	for (let [key, selectedItem] of avsManual) {
		try {
			updateAVSTab(selectedItem)
		} catch (error) {
			console.log("AVS " + selectedItem.imgId + " is not in the results list");
		}
	}
}
