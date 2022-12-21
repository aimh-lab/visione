

const searchFormID = {
	id: '0'
};

const addButton = `<button id="addNewCanvas" class="btn btn-outline-info btn-lg" title="add a new canvas"> <i class="fa fa-plus-circle"></i></button>`

const searchForm = (canvasID = 0, bar = 'hey') => { 
		return `
				<div id='canvasTab'
		style="border: 0px solid #dee2e6; border-radius: 20px; padding-top: 15px;">
		<span
			style="vertical-align: bottom; border-style: solid; border-width: 0px; border-radius: 15px;">
			<input type="radio" id="canvas${canvasID}_enabled"
			name="canvas${canvasID}" value="enabled" checked
			onchange="setCanvasState(0, this)"><label
			for="canvas${canvasID}_enabled"
			style="color: green; font-weight: bold;">Enabled</label> <input
			type="radio" id="canvas${canvasID}_disabled" name="canvas${canvasID}"
			value="disabled" onchange="setCanvasState(0, this)"><label
			for="canvas${canvasID}_disabled"
			style="color: gray; font-weight: bold;">Disabled &nbsp;</label>
		|</span>
<span
						style="font-size: smallest; vertical-align: bottom; border-style: solid; border-width: 0px; padding-left: 2px; padding-right: 2px; padding-top: 5px; padding-bottom: 5px; border-radius: 15px;">
							Objects in <input type="radio" id="and${canvasID}"
							name="occur${canvasID}" value="and" checked
							onchange="setOccur(this, ${canvasID})"><label for="and${canvasID}">AND</label>
							<input type="radio" id="or${canvasID}" name="occur${canvasID}"
							value="or" onchange="setOccur(this, ${canvasID})"><label
							for="or${canvasID}">OR</label>
					</span>

		<div style="position: relative;">
			<div id="overlay${canvasID}">
				<div align="center" id="text${canvasID}" style="color: gray;">Disabled</div>
			</div>
			<div id="canvasdiv1">
				<canvas id='canvas${canvasID}' width=250 height=140
					style="border: 1px solid #000000;"></canvas>
			</div>
			<table>

				<tr>
					<td colspan="13" title="Scene Description"><input
						id='annotations${canvasID}' type="text" size="0"
						style="display: none;"></td>
				</tr>
				<tr valign="top">
					<td colspan="13" title="Max Objects Number"><textarea
							id='not${canvasID}' cols="38" rows="2" style="font-size:12px;"
							placeholder="Max Obj: e.g.: 2 person 3 car 0 dog, means at most 2 persons, 3 cars, no dogs"></textarea></td>
				</tr>
				<tr valign="top">
					<td colspan="12" title="Scene Description"><textarea
							id='textual${canvasID}' cols="38" rows="3" style="font-size:12px;" 
							placeholder="Desc: e.g.: A tennis player serving a ball on the court"></textarea></td>
					<td>						
						<button id="recordButton${canvasID}"
							class="btn btn-outline-success btn-sm"
							title="Speech to text and translate">
							<i class="fa fa-microphone"></i>
						</button>
						<button id="stopButton${canvasID}"
							class="btn btn-outline-danger btn-sm"
							style="display:none"
							title="Stop Record">
							<i class="fa fa-microphone"></i>
						</button>
					</td>
				</tr>
				<!--<tr valign="top">
					<td colspan="13" title="Scene Description"><textarea
							id='clip${canvasID}' cols="39" rows="2"
							placeholder="FOLS"></textarea></td>
				</tr>-->
			</table>

			<table style="width: 95%;">
				<tr>

					<td align="left">
						<button id="clean${canvasID}"
							class="btn btn-outline-danger btn-sm" title="clean canvas 1">
							<i class="fa fa-trash"></i>
						</button>
						<button id="undo${canvasID}"
							class="btn btn-outline-success btn-sm"
							title="undo clean canvas 1">
							<i class="fa fa-undo"></i>
						</button>
					</td>
					<td><span style="vertical-align: top;"
						title="Black & White Keyframe"> <input
							id='isGray${canvasID}' type="checkbox"
							onchange="setGray(${canvasID})"></span> <span
						style="vertical-align: top;" title="Black & White Keyframe">B/W</span>
						<div>
							<span style="vertical-align: top;" title="Color Keyframe">
								<input id='isColor${canvasID}' type="checkbox"
								onchange="setColor(${canvasID})">
							</span> <span title="Color Keyframe"
								style="vertical-align: top; background: linear-gradient(to right, #FF0000 0%, #00FF00 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Color&nbsp;</span>
						</div></td>
						<td valign="right">
						<span onclick="setTextualMode(${canvasID}, 'clip')">
							<input type="radio" checked name="textualMode${canvasID}" id="textualMode${canvasID}">
							<label for="textualMode${canvasID}" style="color: green; font-weight: bold;">CLIP</label>
						</span>
						<span onclick="setTextualMode(${canvasID}, 'aladin')">
							<input type="radio" name="textualMode${canvasID}" id="textualMode${canvasID}">
							<label for="textualMode${canvasID}" style="color: green; font-weight: bold;">ALADIN</label>
						</span>
					</span>
						</td>
				</tr>
			</table>



		</div>
	</div>
					
					`
					}

