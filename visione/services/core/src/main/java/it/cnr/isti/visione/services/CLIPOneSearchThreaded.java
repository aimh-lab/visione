package it.cnr.isti.visione.services;

import java.io.IOException;
import java.util.concurrent.BlockingQueue;

import org.apache.hc.core5.http.ParseException;

import it.cnr.isti.visione.lucene.LucTextSearch;

public class CLIPOneSearchThreaded  implements Runnable {

		private BlockingQueue<SearchResults[]> hits_tmp;
		private LucTextSearch searcher;
		private String clipQuery;

		public CLIPOneSearchThreaded(BlockingQueue<SearchResults[]> hits_tmp, LucTextSearch searcher, String clipQuery) {
			this.hits_tmp = hits_tmp;
			this.searcher = searcher;
			this.clipQuery = clipQuery;
		}

		@Override
		public void run() {
			try {
				System.out.println("Clippone");
				long time = -System.currentTimeMillis();
				hits_tmp.add(searcher.searchByCLIPOne(clipQuery));
				time += System.currentTimeMillis();
				System.out.println("**Search CLIPPONE:\t"+ time+" ms");	
			} catch (ParseException | IOException e) {
				e.printStackTrace();
			} //adding CLIP--nb CLIP is always added as first element in hits_tmp
		}
	}
