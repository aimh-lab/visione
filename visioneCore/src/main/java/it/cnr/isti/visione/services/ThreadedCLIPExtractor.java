package it.cnr.isti.visione.services;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.BlockingQueue;

import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.CloseableHttpResponse;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.core5.http.HttpEntity;
import org.apache.hc.core5.http.ParseException;
import org.apache.hc.core5.http.io.entity.EntityUtils;

import com.google.gson.Gson;


public class ThreadedCLIPExtractor implements Runnable {
	
    private BlockingQueue<SearchResults[]> queue;
    private String textQuery;

	private static Gson gson = new Gson();
	
	public ThreadedCLIPExtractor(BlockingQueue<SearchResults[]> queue, String textQuery) {
        this.queue = queue;
        this.textQuery = textQuery;
	}
	
    public void run() {
		SearchResults[] results = null;
    	try {
			try (final CloseableHttpClient httpclient = HttpClients.createDefault()) {
				String encodedQuery = URLEncoder.encode(textQuery, StandardCharsets.UTF_8);
				System.out.println(encodedQuery);
				final HttpGet httpget = new HttpGet(Settings.CLIP_SERVICE + "?text=" + encodedQuery + "&k=" + Settings.K);

				try (final CloseableHttpResponse response = httpclient.execute(httpget)) {
					final HttpEntity resEntity = response.getEntity();
					if (resEntity != null) {
						String res = EntityUtils.toString(resEntity);
						results = gson.fromJson(res, SearchResults[].class);
					}
				}
			}
        } catch (IOException | ParseException e) {
            Thread.currentThread().interrupt();
        }
    	queue.add(results);
    }
	
}
