//webkitURL is deprecated but nevertheless
URL = window.URL || window.webkitURL;

var gumStream; 						//stream from getUserMedia()
var recorder; 						//WebAudioRecorder object
var input; 							//MediaStreamAudioSourceNode  we'll be recording
var encodeAfterRecord = true;       // when to encode

// shim for AudioContext when it's not avb. 
var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext; //new audio context to help us record

var encodingType = 'wav';



function startRecording(idx) {
	console.log("startRecording() called");
	//document.getElementById("recordButton" + idx).style.display = 'none';
	//document.getElementById("stopButton" + idx).style.display = 'block';


	/*
		Simple constraints object, for more advanced features see
		https://addpipe.com/blog/audio-constraints-getusermedia/
	*/
    
    var constraints = { audio: true, video:false }

    /*
    	We're using the standard promise based getUserMedia() 
    	https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
	*/

	navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
		__log("getUserMedia() success, stream created, initializing WebAudioRecorder...");

		/*
			create an audio context after getUserMedia is called
			sampleRate might change after getUserMedia is called, like it does on macOS when recording through AirPods
			the sampleRate defaults to the one set in your OS for your playback device

		*/
		audioContext = new AudioContext();

		//assign to gumStream for later use
		gumStream = stream;
		
		/* use the stream */
		input = audioContext.createMediaStreamSource(stream);
		
		//stop the input from playing back through the speakers
		//input.connect(audioContext.destination)

		recorder = new WebAudioRecorder(input, {
		  workerDir: "js/WebAudioRecorder/", // must end with slash
		  encoding: encodingType,
		  numChannels:2, //2 is the default, mp3 encoding supports only 2
		  onEncoderLoading: function(recorder, encoding) {
		    // show "loading encoder..." display
		    __log("Loading "+encoding+" encoder...");
		  },
		  onEncoderLoaded: function(recorder, encoding) {
		    // hide "loading encoder..." display
		    __log(encoding+" encoder loaded");
		  }
		});

		recorder.onComplete = function(recorder, blob) { 
			speech2TxtBase64(blob, idx);
		}

		recorder.setOptions({
		  timeLimit:120,
		  encodeAfterRecord:encodeAfterRecord,
	      ogg: {quality: 0.5},
	      mp3: {bitRate: 160}
	    });

		//start the recording process
		recorder.startRecording();

		 __log("Recording started");

	})
}

function stopRecording() {
	console.log("stopRecording() called");
	
	//stop microphone access
	gumStream.getAudioTracks()[0].stop();
	
	//tell the recorder to finish the recording (stop recording + encode the recorded audio)
	recorder.finishRecording();

	__log('Recording stopped');
}

function speech2TxtBase64(blob, idx) {
	var url = URL.createObjectURL(blob)
	console.log('blob:' + url)	
	var reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = function () {
		base64 = reader.result.split(',')[1];
		remainder = base64.length % 4
		if (remainder  != 0)
    		base64 += '=' * (4 - remainder) 
		$.ajax({
			type : "POST",
			async : true,
			crossDomain: true,
			data: {speech: base64},
			dataType : "text",
			url : speech2TextService+"/speechb64",
			success : function(data) {
				setSpeech(data, idx);
			},
			error : function(data) {
				setSpeech(null, idx);
			}
		});
	}
}

function speech2Txt(blob, idx) {
	var fd = new FormData();
	//fd.append('fname', 'query');
	fd.append('data', blob);
	console.log(fd);
	$.ajax({
	    type: 'POST',
		url : speech2TextService+"/speech",
	    data: fd,
	    processData: false,
	    contentType: false,
		success : function(data) {
			setSpeech(data, idx);
		},
		error : function(data) {
			setSpeech(null, idx);
		}
	});
}




//helper function
function __log(e, data) {
	log.innerHTML += "\n" + e + " " + (data || '');
}