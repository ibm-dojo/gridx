define([
	"dojo/_base/declare",
	"dojo/_base/array",
	"dojo/_base/Deferred",
	"dojo/_base/query",
	"dojo/_base/sniff",
	"dojo/dom-geometry",
	"dojo/dom-class",
	"dojo/dom-style",
	"dojo/keys",
	"../core/_Module"
], function(declare, array, Deferred, query, sniff, domGeometry, domClass, domStyle, keys, _Module){

	return declare(/*===== "gridx.modules.ColumnWidth", =====*/_Module, {
		// summary:
		//		Manages column width distribution, allow grid autoWidth and column autoResize.

		name: 'columnWidth',
	
		forced: ['hLayout'],

		getAPIPath: function(){
			// tags:
			//		protected extension
			return {
				columnWidth: this
			};
		},

		constructor: function(){
			this._init();
		},

		preload: function(){
			// tags:
			//		protected extension
			var t = this,
				g = t.grid;
			t._ready = new Deferred();
			t.batchConnect(
				[g, '_onResizeBegin', function(changeSize, ds){
					ds.header = new Deferred();
					var w = g.domNode.clientWidth - g.hLayout.lead - g.hLayout.tail;
					g.bodyNode.style.width = (w < 0 ? 0 : w) + 'px';
					ds.header.callback();
				}],
				[g.hLayout, 'onUpdateWidth', '_onUpdateWidth'],
				[g, 'setColumns', '_onSetColumns']);
		},

		load: function(){
			this._adaptWidth();
			this.loaded.callback();
		},

		//Public-----------------------------------------------------------------------------

		// default: Number
		//		Default column width. Applied when it's not possible to decide accurate column width from user's config.
		'default': 60,

		// autoResize: Boolean
		//		If set to true, the column width can only be set to auto or percentage values (if not, it'll be regarded as auto),
		//		then the column will automatically resize when the grid width is changed (this is the default behavior of an
		//		HTML table).
		autoResize: false,

		onUpdate: function(){},

		//Private-----------------------------------------------------------------------------
		_init: function(){
			var t = this,
				g = t.grid,
				dn = g.domNode,
				cols = g._columns;
			array.forEach(cols, function(col){
				if(!col.hasOwnProperty('declaredWidth')){
					col.declaredWidth = col.width = col.width || 'auto';
				}
			});
			if(g.autoWidth){
				array.forEach(cols, function(c){
					if(c.declaredWidth == 'auto'){
						c.width = t.arg('default') + 'px';
					}
				});
			}else if(t.arg('autoResize')){
				domClass.add(dn, 'gridxPercentColumnWidth');
				array.forEach(cols, function(c){
					if(!(/%$/).test(c.declaredWidth)){
						c.width = 'auto';
					}
				});
			}
		},

		_onUpdateWidth: function(){
			var t = this,
				g = t.grid;
			if(g.autoWidth){
				t._adaptWidth();
			}else{
				var noHScroller = g.hScrollerNode.clientWidth >= g.hScrollerNode.scrollWidth;
				t._adaptWidth(!noHScroller);
				if(!t.arg('autoResize') && noHScroller){
					query('.gridxCell', g.bodyNode).forEach(function(cellNode){
						var col = g._columnsById[cellNode.getAttribute('colId')];
						if(t.arg('autoResize') ||
							!col.declaredWidth ||
							col.declaredWidth == 'auto' ||
							(/%$/).test(col.declaredWidth)){
							cellNode.style.width = col.width;
						}
					});
				}
			}
		},

		_adaptWidth: function(skip){
			var t = this,
				g = t.grid,
				dn = g.domNode,
				header = g.header,
				ltr = g.isLeftToRight(),
				marginLead = ltr ? 'marginLeft' : 'marginRight',
				marginTail = ltr ? 'marginRight' : 'marginLeft',
				lead = g.hLayout.lead,
				tail = g.hLayout.tail,
				innerNode = header.innerNode,
				bs = g.bodyNode.style,
				hs = innerNode.style,
				bodyWidth = (dn.clientWidth || domStyle.get(dn, 'width')) - lead - tail,
				refNode = query('.gridxCell', innerNode)[0],
				padBorder = domGeometry.getMarginBox(refNode).w - domGeometry.getContentBox(refNode).w,
				isGridHidden = !dn.offsetHeight,
				isCollapse = domStyle.get(refNode, 'borderCollapse') == 'collapse';
			hs[marginLead] = bs[marginLead] = lead + 'px';
			hs[marginTail] = tail + 'px';
			bodyWidth = bodyWidth < 0 ? 0 : bodyWidth;
			if(sniff('ie') < 8){
				hs.width = bodyWidth + 'px';
			}
			if(skip){
				bs.width = bodyWidth + 'px';
				t.onUpdate();
				return;
			}
			if(isCollapse){
				padBorder += isGridHidden ? -1 : 1;
			}
			if(g.autoWidth){
				var headers = query('th.gridxCell', innerNode),
					totalWidth = isCollapse ? 2 : 0;
				headers.forEach(function(node){
					var w = domStyle.get(node, 'width');
					if(!sniff('safari') || !isGridHidden){
						w += padBorder;
					}
					totalWidth += w;
					if(isCollapse){
						totalWidth--;
					}
					var c = g._columnsById[node.getAttribute('colid')];
					if(c.width == 'auto' || (/%$/).test(c.width)){
						node.style.width = c.width = w + 'px';
					}
				});
				bs.width = totalWidth + 'px';
				dn.style.width = (lead + tail + totalWidth) + 'px';
			}else{
				bs.width = bodyWidth + 'px';
				if(!t.arg('autoResize')){
					var autoCols = [],
						cols = g._columns,
						fixedWidth = isCollapse ? 2 : 0;
					array.forEach(cols, function(c){
						if(c.declaredWidth == 'auto'){
							autoCols.push(c);
						}else if(/%$/.test(c.declaredWidth)){
							c.width = parseInt(bodyWidth * parseFloat(c.declaredWidth, 10) / 100 - 
								(sniff('safari') ? (isCollapse ? 1 : 0) : padBorder), 10) + 'px';
							header.getHeaderNode(c.id).style.width = c.width;
						}
					});
					array.forEach(cols, function(c){
						if(c.declaredWidth != 'auto'){
							var w = domStyle.get(header.getHeaderNode(c.id), 'width');
							if(/%$/.test(c.declaredWidth)){
								c.width = w + 'px';
							}
							if(!sniff('safari') || !isGridHidden){
								w += padBorder;
							}
							fixedWidth += w;
						}
					});
					if(autoCols.length){
						if(sniff('safari')){
							padBorder = 0;
						}
						var w = bodyWidth > fixedWidth ? ((bodyWidth - fixedWidth) / autoCols.length - padBorder) : t.arg('default'),
							ww = parseInt(w, 10);
						if(bodyWidth > fixedWidth){
							if(sniff('ie') && isCollapse){
								w += cols.length / autoCols.length;
							}
							ww = bodyWidth - fixedWidth - (ww + padBorder) * (autoCols.length - 1) - padBorder;
						}
						w = parseInt(w, 10);
						array.forEach(autoCols, function(c, i){
							header.getHeaderNode(c.id).style.width = c.width = (i < autoCols.length - 1 ? w : ww) + 'px';
						});
					}
				}
			}
			g.hScroller.scroll(0);
			header._onHScroll(0);
			g.vLayout.reLayout();
			t.onUpdate();
		},

		_onSetColumns: function(){
			var t = this,
				g = t.grid;
			t._init();
			g.header.refresh();
			t._adaptWidth();
			g.body.refresh();
		}
	});
});
