package it.cnr.isti.visione.services;

import java.io.IOException;
import java.util.concurrent.BlockingQueue;

import org.apache.hc.core5.http.ParseException;
import org.apache.lucene.search.TopDocs;

import it.cnr.isti.visione.lucene.LucTextSearch;

public class ClipSearchByIDThreaded implements Runnable {

	private BlockingQueue<TopDocs> hits_tmp;
	private LucTextSearch searcher;
	private int k;
	private String queryId;
	private String collection;

	public ClipSearchByIDThreaded(BlockingQueue<TopDocs> hits_tmp, LucTextSearch searcher, String queryId, int k) {
		this.hits_tmp = hits_tmp;
		this.searcher = searcher;
		this.k = k;
		this.queryId = queryId;
	}

	@Override
	public void run() {
		System.out.println("CLIP by ID");
		try {
			hits_tmp.add(searcher.searchByCLIPID(queryId, k));// adding OBJECT and ALADIN (if applicable)
		} catch (IOException | ParseException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}
}
