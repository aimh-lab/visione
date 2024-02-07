function draw_grid(canvas, gridWidth, gridHeight) {
	for (var x = 1; x < (canvas.width / gridWidth); x++) {
		canvas.add(new fabric.Line([ gridWidth * x, 0, gridWidth * x, 600 ], {
			stroke : "#D0D0D0",
			strokeWidth : 1,
			selectable : false,
			strokeDashArray : [ 5, 5 ]
		}));
		canvas.add(new fabric.Line([ 0, gridHeight * x, 600, gridHeight * x ],
				{
					stroke : "#D0D0D0",
					strokeWidth : 1,
					selectable : false,
					strokeDashArray : [ 5, 5 ]
				}));
	}
}

function get_canvas(canvas_id, annotations_id, not_id) {

	canvas = new fabric.Canvas(canvas_id);
	canvas.uniScaleTransform = true;
	canvas.selection = false;
	isCanvasClean[canvas_id] = false;
	isReset = false;
	draw_grid(canvas, cellWidth, cellHeight);

	canvas.on('mouse:down', function(o) {
		console.log('mouse:down');

		draggedLabel = '';
		if (!o.target && !activeCanvas.selection) {
			isDrawing = true;
			var pointer = activeCanvas.getPointer(o.e);
			origX = pointer.x;
			origY = pointer.y;

			var imgElement = document.getElementById(draggedLabel);

			rect = new fabric.Image(imgElement, {
				left: origX,
				top: origY,
				width: pointer.x-origX,
				height: pointer.y-origY,
				fill: '',
				stroke : 'black',
				type : 'rect',
				uuid : generateUUID(),
				strokeWidth : 1,// FRANCA

			});
			activeCanvas.add(rect);
		}

		if (o.target) {
		 	if (o.target.get('type') == 'rect') {
				$("#" + o.target.get('uuid')).hide();
			} else {
				groupObjects = o.target.getObjects();
				for (thing in groupObjects) {
					obj = groupObjects[thing];
					$("#" + obj.get('uuid')).hide();
				}
			}
		}
	});

	canvas.on('mouse:move', function(o) {
				activeCanvas = canvas0;
		activeCanvasIdx = 0;

		var pointer = canvas1.getPointer(event.e);
		var posX = pointer.x;
		var posY = pointer.y;
		if ((posX >= 0 && posX <= canvasWidth) && (posY >= 0 && posY <= canvasHeight)) {
			activeCanvas = canvas1;
			activeCanvasIdx = 1;
		}

	    if (isDrawing && !activeCanvas.selection && rect != null) {
		    var pointer = activeCanvas.getPointer(o.e);

		   	if(origX>pointer.x){
		        rect.set({ left: Math.abs(pointer.x) });
		    }
		    if(origY>pointer.y){
		        rect.set({ top: Math.abs(pointer.y) });
		    }
		    rect.set({ width: Math.abs(origX - pointer.x) });
		    rect.set({ height: Math.abs(origY - pointer.y) });
		    activeCanvas.renderAll();
	   }
	});

	canvas.on('mouse:dblclick', function(o) {
		if (o.target) {
			if (o.target.get('type') == 'rect') {
				activeCanvas.sendToBack(o.target);
				activeCanvas.discardActiveObject().renderAll();
			}
		}
	});

	canvas.on('mouse:up', function(o) {
		console.log('mouse:up');

		groupObjects = null;

		if (isDrawing && !activeCanvas.selection) {
			isDrawing = false;
			activeCanvas.remove(rect);
			if (rect.width >= cellWidth/3 && rect.height >= cellHeight/3) {
				//$("#dialog").append("<label>tag</label> <input id='tag' name='tag' type='text'>");
				$("#dialog").dialog("open");
				$("#tag").autocomplete({
				      source: null
				 });
			} else
				return;

		} else if (o.target) {
			if (o.target.get('type') == 'rect') {
				label =$("#" + o.target.get('uuid')).attr('title');
				$("#" + o.target.get('uuid')).remove();
				addDeleteBtn(label, o.target);
			} else  if (o.target.get('type') == 'activeSelection') {
				groupObjects = o.target.getObjects();
				for (thing in groupObjects) {
					obj = groupObjects[thing];
					o.target.removeWithUpdate(obj);
			    	label =$("#" + obj.get('uuid')).attr('title');
					$("#" + obj.get('uuid')).remove();
					addDeleteBtn(label, obj);
			   }
			}
		} else
			return;
    	isCanvasClean[canvas_id] = false;
		isReset = false;
		query1 = cell2Text(0);
		query2 = cell2Text(1);
		searchByForm();

		if (groupObjects != null) {
			for (thing in groupObjects) {
				obj = groupObjects[thing];
				o.target.addWithUpdate(obj);
		    }
		}

		//set coordinates for proper mouse interaction
		var objs = activeCanvas.getObjects();
		for (var i = 0 ; i < objs.length; i++) {
			objs[i].setCoords();
		}
	});



		$("#" + annotations_id).autocomplete({
		      source: null
		 });

		//var canvasWrapper = document.getElementById('canvas');
		$("#" + annotations_id).keyup(function(e) {
			annotations = $("#" + annotations_id).val();
			if (annotations != '') {
				//terms = jQuery.parseJSON(getTerms(annotations));
				terms = mifileAnnotations;
				words =  annotations.split(" ");
				lastTerm = words[words.length - 1];
				if (lastTerm.length >= 3 && e.which != 13) {
					$("#" + annotations_id).autocomplete({
				        minLength: 3,
				        source: function( request, response ) {
				          // delegate back to autocomplete, but extract the last term
				          response( $.ui.autocomplete.filter(
				        	mifileAnnotations, extractLast( request.term ) ) );
				        },
				        focus: function() {
				          // prevent value inserted on focus
				          return false;
				        },
				        select: function( event, ui ) {
				          var terms = split( this.value );
				          // remove the current input
				          terms.pop();
				          // add the selected item
				          terms.push( ui.item.value.split(',')[0] );
				          // add placeholder to get the comma-and-space at the end
				          terms.push( "" );
				          this.value = terms.join( " " );
						query1 = cell2Text(0);
						query2 = cell2Text(1);

						searchByForm();
				          return false;
				        }
				      });
				} else {
					$( "#" + annotations_id ).autocomplete( "option", "source", '' );
				}
			}
			 if(e.which == 13 || annotations.trim() == '') {
						query1 = cell2Text(0);
						query2 = cell2Text(1);

						searchByForm();
			 }
		});

		/*
		$("#not").keyup(function(e) {
			notField = $("#not").val();
			cell2Text();
		});
		*/

		$("#" + not_id).keyup(function(e) {
			notField = $("#" + not_id).val();
			if (notField != '') {
				notField = notField.replace(new RegExp("([0-9])([a-z])", "g"), "$1 $2");
				console.log('>>>' + notField);
				$("#" + not_id).val(notField);
				words =  notField.split(" ");
				lastTerm = words[words.length - 1];
				if (lastTerm.length >= 3 && e.which != 13) {
					$( "#" + not_id ).autocomplete({
				        minLength: 3,
				        source: function( request, response ) {
				          // delegate back to autocomplete, but extract the last term
				          response( $.ui.autocomplete.filter(
				        	availableTags, extractLast( request.term ) ) );
				        },
				        focus: function() {
				          // prevent value inserted on focus
				          return false;
				        },
				        select: function( event, ui ) {
				          var terms = split( this.value );
				          // remove the current input
				          terms.pop();
				          // add the selected item
				          terms.push( ui.item.value.split(',')[0] );
				          // add placeholder to get the comma-and-space at the end
				          terms.push( "" );
				          this.value = terms.join( " " );
						query1 = cell2Text(0);
						query2 = cell2Text(1);
						searchByForm();
				          return false;
				        }
				      });
				} else {
					$( "#" + not_id ).autocomplete( "option", "source", '' );
				}
			}
			 if(e.which == 13 || notField.trim() == '') {
				 $( "#" + not_id ).autocomplete( "option", "source", '' );
						query1 = cell2Text(0);
						query2 = cell2Text(1);

						searchByForm();
;
			 }
		});

		//workaround to avoid twice calls of #diagog event, maybe a bug of  jquery
		$("#dialog").off();
		$("#dialog").keyup(function(e) {
			textVal = $("#tag").val().trim();
			if (textVal.length >= 2) {
				//$( "#tag" ).autocomplete( "option", "source", availableTags );
				$( "#tag" ).autocomplete({
			        minLength: 2,
			        source: function( request, response ) {
			          // delegate back to autocomplete, but extract the last term
			          response( $.ui.autocomplete.filter(
			        	availableTags, extractLast( request.term ) ) );
			        },
			        focus: function() {
			          // prevent value inserted on focus
			          return false;
			        },
			        select: function( event, ui ) {
			          var terms = split( this.value );
			          // remove the current input
			          terms.pop();
			          // add the selected item
			          terms.push( ui.item.value.split(',')[0] );
			          // add placeholder to get the comma-and-space at the end
			          terms.push( "" );
			          this.value = terms.join( " " );
			          return false;
			        }
			      });
			} else {
				$( "#tag" ).autocomplete( "option", "source", '' );
			}
			 var key = e.which;
			 if(key == 13) {
				if (textVal) {
					activeCanvas.add(rect);
					addDeleteBtn(textVal.trim(), rect);
				    rect = null;
				}

				$(this).closest('.ui-dialog-content').dialog('close');
				$("#tag").val('');

						query1 = cell2Text(0);
						query2 = cell2Text(1);
						searchByForm();

				//set coordinates for proper mouse interaction
				var objs = activeCanvas.getObjects();
			    for (var i = 0 ; i < objs.length; i++) {
					objs[i].setCoords();
				}
			}
		});

		 $('#dialog').on('dialogclose', function(event) {
			 $("#tag").val('');
		 });

	return canvas;

}