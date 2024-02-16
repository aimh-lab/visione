package it.cnr.isti.visione.services;

import java.io.IOException;
import java.lang.reflect.Type;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ExecutionException;

import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.core5.http.ClassicHttpRequest;
import org.apache.hc.core5.http.ClassicHttpResponse;
import org.apache.hc.core5.http.HttpStatus;
import org.apache.hc.core5.http.ParseException;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.apache.hc.core5.http.io.entity.StringEntity;
import org.apache.hc.core5.http.io.support.ClassicRequestBuilder;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonDeserializationContext;
import com.google.gson.JsonDeserializer;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParseException;
import com.google.gson.FieldNamingPolicy;

public class ExternalSearch implements Callable<SearchResults[]> {
    /**
     * This class handles searching features indexed externally to Lucene (i.e., FAISS)
     * It wraps communication with extractors and with the FAISS index manager.
     */

    public String featureName;
    public String extractorEndpoint;
    public String indexManagerEndpoint;

    private static Gson gsonUnderscore = new GsonBuilder()
            .setFieldNamingPolicy(FieldNamingPolicy.LOWER_CASE_WITH_UNDERSCORES) // featureVector --> feature_vector
            .create();

    private static Gson gson = new GsonBuilder()
            .setFieldNamingPolicy(FieldNamingPolicy.IDENTITY)
            .registerTypeAdapter(SearchResults.class, new SearchResultsDeserializer())
            .create();

    static class SearchResultsDeserializer implements JsonDeserializer<SearchResults> {
        @Override
        public SearchResults deserialize(JsonElement json, Type typeOfT, JsonDeserializationContext context) throws JsonParseException {
            JsonObject jsonObject = json.getAsJsonObject();
            String imgId = jsonObject.get("imgId").getAsString();
            Float score = jsonObject.get("score").getAsFloat();
            SearchResults sr = new SearchResults(imgId, score);
            return sr;
        }
    }

    public ExternalSearch(String featureName) {
        this.featureName = featureName;
        this.extractorEndpoint = "http://features-" + featureName.toLowerCase() + ":8080";
        this.indexManagerEndpoint = "http://faiss-index-manager:8080";
    }

    public ExternalSearch(String featureName, String extractorEndpoint, String indexManagerEndpoint) {
        this.featureName = featureName;
        this.extractorEndpoint = extractorEndpoint;
        this.indexManagerEndpoint = indexManagerEndpoint;
    }

    private <T> T parseResponse(ClassicHttpResponse response, Class<T> classOfT) throws IOException, ParseException {
        int statusCode = response.getCode();
        String responseBody = EntityUtils.toString(response.getEntity());
        if (statusCode == HttpStatus.SC_OK) {
            return gson.fromJson(responseBody, classOfT);
        } else {
            System.err.println("HTTP error occurred. Status code: " + statusCode);
            System.err.println("Response body: " + responseBody);
            return null;
        }
    }

    private SearchResults[] queryFaissManager(FaissManagerRequest jsonRequest) {
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            String jsonBody = gsonUnderscore.toJson(jsonRequest);
            ClassicHttpRequest request = ClassicRequestBuilder
                    .post(indexManagerEndpoint + "/search")
                    .addHeader("Content-Type", "application/json")
                    .setEntity(new StringEntity(jsonBody))
                    .build();
            System.out.println(request);
            // System.out.println(jsonBody);

            ClassicHttpResponse response = httpClient.execute(request);
            SearchResults[] results = parseResponse(response, SearchResults[].class);
            return results;
        } catch (IOException | ParseException e) {
            e.printStackTrace();
            return null;
        }
    }

    public SearchResults[] searchByVector(Float[] queryVector, int k) {
        long elapsed = -System.currentTimeMillis();
        SearchResults[] results = queryFaissManager(new FaissManagerRequest(featureName, queryVector, k));
        elapsed += System.currentTimeMillis();
        System.out.println("** " + featureName + " search: " + elapsed + " ms");
        return results;
    }

    public SearchResults[] searchByID(String id, int k) {
        long elapsed = -System.currentTimeMillis();
        SearchResults[] results = queryFaissManager(new FaissManagerRequest(featureName, id, k));
        elapsed += System.currentTimeMillis();
        System.out.println("** " + featureName + " search: " + elapsed + " ms");
        return results;
    }

    public SearchResults[] searchByText(String textQuery, int k) {
        // Encode text query
        long elapsed = -System.currentTimeMillis();
        Float[] queryVector = null;
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            ClassicHttpRequest request = ClassicRequestBuilder
                    .get(extractorEndpoint + "/get-text-feature")
                    .addParameter("text", textQuery)
                    .build();
            System.out.println(request);

            ClassicHttpResponse response = httpClient.execute(request);
            queryVector = parseResponse(response, Float[].class);
        } catch (IOException | ParseException e) {
            e.printStackTrace();
            return null;
        }
        elapsed += System.currentTimeMillis();
        System.out.println("** " + featureName + " encode text quey: " + elapsed + " ms");
        return searchByVector(queryVector, k);
    }

    private class FaissManagerRequest {
        public String type;
        public Float[] featureVector;
        public String queryId;
        public int k;

        public FaissManagerRequest(String type, Float[] featureVector, int k) {
            this.type = type;
            this.featureVector = featureVector;
            this.queryId = null;
            this.k = k;
        }

        public FaissManagerRequest(String type, String queryId, int k) {
            this.type = type;
            this.featureVector = null;
            this.queryId = queryId;
            this.k = k;
        }
    }

    // Callable interface for threading use
    private String callQueryType;
    private Float[] callQueryVector;
    private String callQueryId;
    private String callQueryText;
    private int callQueryK;

    public ExternalSearch setQueryByVector(Float[] queryVector, int k) {
        this.callQueryType = "vector";
        this.callQueryVector = queryVector;
        this.callQueryId = null;
        this.callQueryText = null;
        this.callQueryK = k;
        return this;
    }

    public ExternalSearch setQueryByID(String id, int k) {
        this.callQueryType = "id";
        this.callQueryVector = null;
        this.callQueryId = id;
        this.callQueryText = null;
        this.callQueryK = k;
        return this;
    }

    public ExternalSearch setQueryByText(String textQuery, int k) {
        this.callQueryType = "text";
        this.callQueryVector = null;
        this.callQueryId = null;
        this.callQueryText = textQuery;
        this.callQueryK = k;
        return this;
    }

    public SearchResults[] call() throws Exception {
        if (callQueryType == null)
            throw new Exception("Query type not set");

        switch (callQueryType) {
            case "vector":
                return searchByVector(callQueryVector, callQueryK);
            case "id":
                return searchByID(callQueryId, callQueryK);
            case "text":
                return searchByText(callQueryText, callQueryK);
            default:
                throw new Exception("Invalid query type");
        }
    }

    public static void main(String[] args) {
        // ExternalSearch es = new ExternalSearch("clip-laion");
        // SearchResults[] results = es.searchByID(args[0], 100);
        // for (SearchResults result : results)
        // System.out.println(result);

        ExecutorService executor = Executors.newFixedThreadPool(3);

        ExternalSearch es1 = new ExternalSearch("clip-laion").setQueryByID(args[0], 10);
        ExternalSearch es2 = new ExternalSearch("biomed-clip").setQueryByID(args[0], 10);
        ExternalSearch es3 = new ExternalSearch("clip2video").setQueryByID(args[0], 10);

        Future<SearchResults[]> future1 = executor.submit(es1);
        Future<SearchResults[]> future2 = executor.submit(es2);
        Future<SearchResults[]> future3 = executor.submit(es3);

        try {
            SearchResults[] results1 = future1.get();
            SearchResults[] results2 = future2.get();
            SearchResults[] results3 = future3.get();

            System.out.println("Results 1:");
            for (SearchResults result : results1)
                System.out.println(result);

            System.out.println("Results 2:");
            for (SearchResults result : results2)
                System.out.println(result);

            System.out.println("Results 3:");
            for (SearchResults result : results3)
                System.out.println(result);

        } catch (InterruptedException | ExecutionException e) {
            e.printStackTrace();
        } finally {
            executor.shutdown();
        }
    }
}
