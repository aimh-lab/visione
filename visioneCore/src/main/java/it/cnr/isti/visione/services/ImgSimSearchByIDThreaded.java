package it.cnr.isti.visione.services;

import java.io.IOException;
import java.util.concurrent.BlockingQueue;

import org.apache.lucene.search.TopDocs;

import it.cnr.isti.visione.lucene.LucTextSearch;

public class ImgSimSearchByIDThreaded implements Runnable {

	private BlockingQueue<TopDocs> hits_tmp;
	private LucTextSearch searcher;
	private int k;
	private String queryId;
	private TopDocs hitsToReorder;

	public ImgSimSearchByIDThreaded(BlockingQueue<TopDocs> hits_tmp, LucTextSearch searcher, String queryId, int k, TopDocs hitsToReorder) {
		this.hits_tmp = hits_tmp;
		this.hitsToReorder = hitsToReorder;
		this.searcher = searcher;
		this.k = k;
		this.queryId = queryId;
	}

	@Override
	public void run() {
		System.out.println("IMG SIMILARITY  by ID");
		try {
			hits_tmp.add(searcher.searchByID(queryId, k, hitsToReorder));// adding OBJECT and ALADIN (if applicable)
		} catch (IOException | org.apache.lucene.queryparser.classic.ParseException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}
}
