package it.cnr.isti.visione.services;

import java.io.IOException;
import java.util.concurrent.BlockingQueue;

import org.apache.hc.core5.http.ParseException;

import it.cnr.isti.visione.lucene.Fields;
import it.cnr.isti.visione.lucene.LucTextSearch;

public class AladinSearchThreaded implements Runnable {

	private static final int K_Q_ALADIN = 260;// default value 260

	private BlockingQueue<SearchResults[]> hits_tmp;
	private LucTextSearch searcher;
	private VisioneQuery queryObj;
	private int k;
	private String textQuery;

	public AladinSearchThreaded(BlockingQueue<SearchResults[]> hits_tmp, LucTextSearch searcher, String textQuery, VisioneQuery queryObj, int k) {
		this.hits_tmp = hits_tmp;
		this.searcher = searcher;
		this.queryObj = queryObj;
		this.k = k;
		this.textQuery = textQuery;
	}

	@Override
	public void run() {
		System.out.println("ALADIN");
		try {
			String features = ALADINExtractor.text2Features(textQuery, K_Q_ALADIN).trim();
			queryObj.getQuery().put(Fields.ALADIN, features);
			hits_tmp.add(searcher.search(queryObj, k));// adding OBJECT and ALADIN (if applicable)
		} catch (ParseException | IOException | org.apache.lucene.queryparser.classic.ParseException e) {
			e.printStackTrace();
		}
	}
}
