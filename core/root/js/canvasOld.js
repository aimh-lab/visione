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
	isClean = false;
	draw_grid(canvas, cellWidth, cellHeight);

	canvas.on('mouse:down', function(o) {
		console.log('mouse:down');
		
		activeCanvas = canvas1;
		activeCanvasIdx = 0;

		var pointer = canvas2.getPointer(event.e);
		var posX = pointer.x;
		var posY = pointer.y;
		if ((posX >= 0 && posX <= widthCanvas) && (posY >= 0 && posY <= heightCanvas)) {
			activeCanvas = canvas2;
			activeCanvasIdx = 1;
		}
		

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
    	isClean = false;
		//txt = cell2Text(isClean, canvas);
		query1 = cell2Text(false, canvas1);
		query2 = cell2Text(false, canvas2);
			
		performSearch2(query1, query2);
		
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
	
		$(document).on('click',".deleteBtn",function(event){
			canvas1.getObjects().forEach(function(o) {
		        if(o.uuid === event.target.id) {
		        	activeCanvas.discardActiveObject().renderAll();
		        	activeCanvas.remove(o);
		        }
		    })
		    $("#" + event.target.id).remove();
			query1 = cell2Text(false, canvas1);
			console.log(query1);
			query2 = cell2Text(false, canvas2);
			console.log(query2);
			performSearch2(query1, query2);
		});
		
		
		
		$("#" + annotations_id).autocomplete({
		      source: null
		 });
		
		//var canvasWrapper = document.getElementById('canvas');
		$("#" + annotations_id).keyup(function(e) {
			console.log(e.which);
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
						//cell2Text(isClean, canvas);
						query1 = cell2Text(isClean, canvas1);
						query2 = cell2Text(isClean, canvas2);
			
						performSearch2(query1, query2);
				          return false;
				        }
				      });
				} else {
					$( "#" + annotations_id ).autocomplete( "option", "source", '' );
				}
			}
			 if(e.which == 13 || annotations.trim() == '') {
				 console.log('annotation enter');
				 		//cell2Text(isClean, canvas);
						query1 = cell2Text(isClean, canvas1);
						query2 = cell2Text(isClean, canvas2);
			
						performSearch2(query1, query2);
			 }
		});
		
		/*
		$("#not").keyup(function(e) {
			notField = $("#not").val();
			cell2Text();
		});
		*/
		
		$("#" + not_id).keyup(function(e) {
			console.log(e.which);
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
						//cell2Text(isClean, canvas);
						query1 = cell2Text(isClean, canvas1);
						query2 = cell2Text(isClean, canvas2);
			
						performSearch2(query1, query2);
				          return false;
				        }
				      });
				} else {
					$( "#" + not_id ).autocomplete( "option", "source", '' );
				}
			}
			 if(e.which == 13 || notField.trim() == '') {
				 $( "#" + not_id ).autocomplete( "option", "source", '' );
				 		//cell2Text(isClean, canvas);
						query1 = cell2Text(isClean, canvas1);
						query2 = cell2Text(isClean, canvas2);
			
						performSearch2(query1, query2);
			 }
		});
		
		$("#dialog").keyup(function(e) {
			textVal = $("#tag").val().trim();
			if (textVal.length >= 3) {
				//$( "#tag" ).autocomplete( "option", "source", availableTags );
				$( "#tag" ).autocomplete({
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
				 
						//cell2Text(isClean, canvas);
						query1 = cell2Text(isClean, canvas1);
						query2 = cell2Text(isClean, canvas2);
			
						performSearch2(query1, query2);
					
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

function get_canvas2(canvas_id, annotations_id, not_id) {

	canvas = new fabric.Canvas(canvas_id);
	canvas.uniScaleTransform = true;
	canvas.selection = false;
	isClean = false;
	draw_grid(canvas, cellWidth, cellHeight);

	canvas.on('mouse:down', function(o) {
		console.log('mouse:down');
		activeCanvasIdx = 0;

		var pointer = canvas2.getPointer(event.e);
		var posX = pointer.x;
		var posY = pointer.y;
		if ((posX >= 0 && posX <= widthCanvas) && (posY >= 0 && posY <= heightCanvas)) {
			activeCanvasIdx = 1;

		}

		draggedLabel = '';
		if (!o.target && !canvas.selection) {
			isDrawing = true;
			var pointer = canvas.getPointer(o.e);
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
			canvas.add(rect);
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
	    if (isDrawing && !canvas.selection && rect != null) {
		    var pointer = canvas.getPointer(o.e);
			
		   	if(origX>pointer.x){
		        rect.set({ left: Math.abs(pointer.x) });
		    }
		    if(origY>pointer.y){
		        rect.set({ top: Math.abs(pointer.y) });
		    }
		    rect.set({ width: Math.abs(origX - pointer.x) });
		    rect.set({ height: Math.abs(origY - pointer.y) });
		    canvas.renderAll();
	   }
	});
		
	canvas.on('mouse:dblclick', function(o) {
		if (o.target) {
			if (o.target.get('type') == 'rect') {
				canvas.sendToBack(o.target);
				canvas.discardActiveObject().renderAll();
			}
		}
	});
		
	canvas.on('mouse:up', function(o) {
		console.log('mouse:up');

		groupObjects = null;
	
		if (isDrawing && !canvas.selection) {
			isDrawing = false;
			canvas.remove(rect);
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
    	isClean = false;
				//cell2Text(isClean, canvas);
						query1 = cell2Text(isClean, canvas1);
						query2 = cell2Text(isClean, canvas2);
			
						performSearch2(query1, query2);
		
		if (groupObjects != null) {
			for (thing in groupObjects) {
				obj = groupObjects[thing];
				o.target.addWithUpdate(obj);
		    }
		}
	
		//set coordinates for proper mouse interaction
		var objs = canvas.getObjects();
		for (var i = 0 ; i < objs.length; i++) {
			objs[i].setCoords();
		}
	});
	
		$(document).on('click',".deleteBtn",function(event){
			canvas2.getObjects().forEach(function(o) {
		        if(o.uuid === event.target.id) {
		        	canvas2.discardActiveObject().renderAll();
		        	canvas2.remove(o);
		        }
		    })
		    $("#" + event.target.id).remove();
			query1 = cell2Text(false, canvas1);
			query2 = cell2Text(false, canvas2);
			
			performSearch2(query1, query2);
		});
		
		
		
		$("#" + annotations_id).autocomplete({
		      source: null
		 });
		
		//var canvasWrapper = document.getElementById('canvas');
		$("#" + annotations_id).keyup(function(e) {
			console.log(e.which);
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
						//cell2Text(isClean, canvas);
						query1 = cell2Text(isClean, canvas1);
						query2 = cell2Text(isClean, canvas2);
			
						performSearch2(query1, query2);
				          return false;
				        }
				      });
				} else {
					$( "#" + annotations_id ).autocomplete( "option", "source", '' );
				}
			}
			 if(e.which == 13 || annotations.trim() == '') {
				 console.log('annotation enter');
				 //cell2Text(isClean, canvas);
				query1 = cell2Text(isClean, canvas1);
				query2 = cell2Text(isClean, canvas2);
			
				performSearch2(query1, query2);
			 }
		});
		
		/*
		$("#not").keyup(function(e) {
			notField = $("#not").val();
			cell2Text();
		});
		*/
		
		$("#" + not_id).keyup(function(e) {
			console.log(e.which);
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
						//cell2Text(isClean, canvas);
						query1 = cell2Text(isClean, canvas1);
						query2 = cell2Text(isClean, canvas2);
			
						performSearch2(query1, query2);
				          return false;
				        }
				      });
				} else {
					$( "#" + not_id ).autocomplete( "option", "source", '' );
				}
			}
			 if(e.which == 13 || notField.trim() == '') {
				 $( "#" + not_id ).autocomplete( "option", "source", '' );
				 		//cell2Text(isClean, canvas);
						query1 = cell2Text(isClean, canvas1);
						query2 = cell2Text(isClean, canvas2);
			
						performSearch2(query1, query2);
			 }
		});
		
		$("#dialog").keyup(function(e) {
			textVal = $("#tag").val().trim();
			if (textVal.length >= 3) {
				//$( "#tag" ).autocomplete( "option", "source", availableTags );
				$( "#tag" ).autocomplete({
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
			          return false;
			        }
			      });
			} else {
				$( "#tag" ).autocomplete( "option", "source", '' );
			}
			 var key = e.which;
			 if(key == 13) {
				if (textVal) {
					canvas.add(rect);
					addDeleteBtn(textVal.trim(), rect);
				    rect = null;
				}
		
				$(this).closest('.ui-dialog-content').dialog('close'); 
				$("#tag").val('');
				 
					//cell2Text(isClean, canvas);
						query1 = cell2Text(isClean, canvas1);
						query2 = cell2Text(isClean, canvas2);
			
						performSearch2(query1, query2);
					
				//set coordinates for proper mouse interaction
				var objs = canvas.getObjects();
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