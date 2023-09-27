

const searchFormID = {
	id: '0'
};

const addButton = `<button id="addNewCanvas" class="btn btn-outline-info btn-lg" title="add a new canvas"> <i class="fa fa-plus-circle"></i></button>`

const searchForm = (canvasID = 0, infoText = '', txtSearchTitle = '', css_class = "") => {
	return `
	<div class="advanced scene${canvasID}" id='canvasTab'>
		<div class="">
			<div id="description_objects${canvasID}">
				<div class="font-large font-bold"><i id="sceneDes${canvasID}" class="${css_class}"> ${infoText}</i> </div>

			</div>
			<span class="font-tiny">
				<input type="radio" id="canvas${canvasID}_enabled" name="canvas${canvasID}" value="enabled" checked onchange="setCanvasState(0, this)">
				<label for="canvas${canvasID}_enabled" style="color: green; font-weight: bold;">Enabled</label>
				<input type="radio" id="canvas${canvasID}_disabled" name="canvas${canvasID}" value="disabled" onchange="setCanvasState(0, this)">
				<label for="canvas${canvasID}_disabled" style="color: gray; font-weight: bold;">Disabled &nbsp;</label>
			</span>
			<span>
				Objects in 
				<input type="radio" id="and${canvasID}" name="occur${canvasID}" value="and" checked onchange="setOccur(this, ${canvasID})">
				<label for="and${canvasID}">AND</label>
				<input type="radio" id="or${canvasID}" name="occur${canvasID}" value="or" onchange="setOccur(this, ${canvasID})">
				<label for="or${canvasID}">OR</label>
			</span>
		</div>

		<div id="block${canvasID}" style="position: relative;">
			<div id="canvasBlock${canvasID}" class="advanced">
				<div id="overlay${canvasID}">
					<div align="center" id="text${canvasID}" style="color: gray;">Disabled</div>
				</div>
				<div id="canvasdiv1">
					<canvas id='canvas${canvasID}' width=${canvasWidth} height=${canvasHeight}
						style="border: 1px solid #000000;"></canvas>
				</div>
			</div>
			<div colspan="13" title="Scene Description">
				<input id='annotations${canvasID}' type="text" size="0" style="display: none;">
			</div>
			<div class="advanced" colspan="13" title="Max Objects Number">
				<textarea id='not${canvasID}' class="font-normal" cols="38" rows="2" style="width:275px; border-radius: 6px;" placeholder="Max Obj: e.g.: 2 person 3 car 0 dog, means at most 2 persons, 3 cars, no dogs"></textarea>
				<div id="textual${canvasID}_container" colspan="12" title="Scene Description">


					<div id="div_textual${canvasID}">
						<!--<i id="sceneDes${canvasID}" aria-hidden="true"></i>-->	
						<div  class="Icon-inside">
							<textarea id="textual${canvasID}" type="text" class="textualquery${canvasID} font-normal"  cols="40"  placeholder="${txtSearchTitle}"></textarea>
							<i id="recordButton${canvasID}" class="fa fa-microphone fa-lg fa-fw" aria-hidden="true"></i>
							<i id="cancelText${canvasID}" class="fa fa-times fa-lg fa-fw" aria-hidden="true" style="right:30px; color:gray; display:none"></i>
							<i class="fa fa-search fa-lg fa-fw" style="left:10px; color:gray;"></i>
							<i id="cancelText${canvasID}" class="fa fa-magnifying fa-2xl fa-fw" aria-hidden="true" style="left:10px; color:gray;"></i>
						</div>
					</div>
				</div>
			</div>

			<div class="advanced">
				<div class="canvasClean">
					<div class="canvasCleanItem">
						<button id="clean${canvasID}" class="btn btn-outline-danger btn-sm" title="clean canvas 1">
							<i class="fa fa-trash"></i>
						</button>
						<button id="undo${canvasID}" class="btn btn-outline-success btn-sm" title="undo clean canvas 1">
							<i class="fa fa-undo"></i>
						</button>
					</div>
					<div class="canvasCleanItem">
						<div>
							<span title="Black & White Keyframe"> 
								<input id='isGray${canvasID}' type="checkbox" onchange="setGray(${canvasID})">
							</span>
							<span title="Black & White Keyframe">B/W</span>
						</div>
						<div>
							<span title="Color Keyframe">
								<input id='isColor${canvasID}' type="checkbox" onchange="setColor(${canvasID})">
							</span>
							<span title="Color Keyframe" class="colorCheckbox">
								Color
							</span>
						</div>
					</div>
				</div>
				<div class="textualOptions${canvasID}" id="textualOptions${canvasID}">
					<span onclick="setTextualMode(${canvasID}, 'cv')">
						<input type="radio" name="textualMode${canvasID}" id="textualMode${canvasID}">
						<label for="textualMode${canvasID}" class="font-tiny">ClipVideo</label>
					</span>
					<span onclick="setTextualMode(${canvasID}, 'cl')">
						<input type="radio" name="textualMode${canvasID}" id="textualMode${canvasID}">
						<label for="textualMode${canvasID}" class="font-tiny">ClipLAION</label>
					</span>
					<span onclick="setTextualMode(${canvasID}, 'aladin')">
						<input type="radio" name="textualMode${canvasID}" id="textualMode${canvasID}">
						<label for="textualMode${canvasID}" class="font-tiny">Aladin</label>
					</span>
					<span onclick="setTextualMode(${canvasID}, 'all')">
						<input type="radio" checked name="textualMode${canvasID}" id="textualMode${canvasID}">
						<label for="textualMode${canvasID}" class="font-tiny">use all</label>
					</span>
				</div>
			</div>
		</div>
	</div>
`
}

