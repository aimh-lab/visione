package it.cnr.isti.visione.services;

import java.io.IOException;
import java.util.concurrent.Callable;

import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.core5.http.ClassicHttpRequest;
import org.apache.hc.core5.http.ClassicHttpResponse;
import org.apache.hc.core5.http.HttpStatus;
import org.apache.hc.core5.http.ParseException;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.apache.hc.core5.http.io.entity.StringEntity;
import org.apache.hc.core5.http.io.support.ClassicRequestBuilder;

import org.apache.lucene.search.TopDocs;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import it.cnr.isti.visione.lucene.Fields;
import it.cnr.isti.visione.lucene.LucTextSearch;

import com.google.gson.FieldNamingPolicy;

public class InternalSearch implements Callable<SearchResults[]> {

    public String featureName;
    public LucTextSearch searcher;
    public String extractorEndpoint;
    public String strEncoderEndpoint = "http://str-feature-encoder:8080";

    private static Gson gsonUnderscore = new GsonBuilder()
            .setFieldNamingPolicy(FieldNamingPolicy.LOWER_CASE_WITH_UNDERSCORES) // featureVector --> feature_vector
            .create();

    private static Gson gson = new GsonBuilder()
            .setFieldNamingPolicy(FieldNamingPolicy.IDENTITY)
            .create();

    public InternalSearch(String featureName, LucTextSearch searcher) {
        this.featureName = featureName;
        this.searcher = searcher;
        this.extractorEndpoint = "http://features-" + featureName.toLowerCase() + ":8080";
    }

    public InternalSearch(String featureName, LucTextSearch searcher, String extractorEndpoint) {
        this.featureName = featureName;
        this.searcher = searcher;
        this.extractorEndpoint = extractorEndpoint;
    }

    public SearchResults[] searchBySurrogateText(String surrogateTextQuery, int k) throws IOException { return searchBySurrogateText(surrogateTextQuery, k, null); }
    public SearchResults[] searchBySurrogateText(String surrogateTextQuery, int k, TopDocs hits) throws IOException {
        try {
            String field = (featureName.equals("dinov2")) ? Fields.VISUAL_FEATURES : featureName;  // FIXME: remove this mapping when the new index is ready
            return searcher.searchByExample(field, surrogateTextQuery, k, hits);
        } catch (org.apache.lucene.queryparser.classic.ParseException e) {
            e.printStackTrace();
            return null;
        }
    }

    public SearchResults[] searchByVector(Float[] queryVector, int k) { return searchByVector(queryVector, k, null); }
    public SearchResults[] searchByVector(Float[] queryVector, int k, TopDocs hits) {
        // Encode vector query
        String surrogateTextQuery = null;
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            ClassicHttpRequest request = ClassicRequestBuilder
                    .post(strEncoderEndpoint + "/encode")
                    .addHeader("Content-Type", "application/json")
                    .setEntity(new StringEntity(gsonUnderscore.toJson(new StrEncoderRequest(featureName, queryVector))))
                    .build();
            System.out.println(request);

            ClassicHttpResponse response = httpClient.execute(request);
            int statusCode = response.getCode();
            if (statusCode == HttpStatus.SC_OK) {
                surrogateTextQuery = EntityUtils.toString(response.getEntity());
            } else {
                System.err.println("HTTP error occurred. Status code: " + statusCode);
                return null;
            }
        } catch (IOException | ParseException e) {
            e.printStackTrace();
            return null;
        }

        try {
            return searchBySurrogateText(surrogateTextQuery, k);
        } catch (IOException e) {
            e.printStackTrace();
            return null;
        }
    }

    public SearchResults[] searchByText(String textQuery, int k) { return searchByText(textQuery, k, null); }
    public SearchResults[] searchByText(String textQuery, int k, TopDocs hits) {
        // Encode text query
        Float[] queryVector = null;
        try (CloseableHttpClient httpClient = HttpClients.createDefault()) {
            ClassicHttpRequest request = ClassicRequestBuilder
                    .get(extractorEndpoint + "/get-text-feature")
                    .addParameter("text", textQuery)
                    .build();
            System.out.println(request);

            ClassicHttpResponse response = httpClient.execute(request);
            int statusCode = response.getCode();
            if (statusCode == HttpStatus.SC_OK) {
                String responseBody = EntityUtils.toString(response.getEntity());
                queryVector = gson.fromJson(responseBody, Float[].class);
            } else {
                System.err.println("HTTP error occurred. Status code: " + statusCode);
                return null;
            }
        } catch (IOException | ParseException e) {
            e.printStackTrace();
            return null;
        }

        return searchByVector(queryVector, k, hits);
    }

    public SearchResults[] searchByID(String id, int k) throws IOException { return searchByID(id, k, null); }
    public SearchResults[] searchByID(String id, int k, TopDocs hits) throws IOException {
        String field = (featureName.equals("dinov2")) ? Fields.VISUAL_FEATURES : featureName; // FIXME: remove this mapping when the new index is ready
        String surrogateTextQuery = searcher.getTerms(id, field, true).trim();
        return searchBySurrogateText(surrogateTextQuery, k, hits);
    }

    private class StrEncoderRequest {
        public String type;
        public Float[] featureVector;

        public StrEncoderRequest(String type, Float[] featureVector) {
            this.type = type;
            this.featureVector = featureVector;
        }
    }

    // Callable interface for threading use
    private String callQueryType;
    private String callSurrogateQueryText;
    private Float[] callQueryVector;
    private String callQueryText;
    private String callQueryId;
    private int callQueryK;
    private TopDocs callHits;

    public InternalSearch setQueryBySurrogateText(String surrogateTextQuery, int k) { return setQueryBySurrogateText(surrogateTextQuery, k, null); }
    public InternalSearch setQueryBySurrogateText(String surrogateTextQuery, int k, TopDocs hits) {
        this.callQueryType = "surrogate";
        this.callSurrogateQueryText = surrogateTextQuery;
        this.callQueryVector = null;
        this.callQueryText = null;
        this.callQueryId = null;
        this.callQueryK = k;
        this.callHits = hits;
        return this;
    }

    public InternalSearch setQueryByVector(Float[] queryVector, int k) { return setQueryByVector(queryVector, k, null); }
    public InternalSearch setQueryByVector(Float[] queryVector, int k, TopDocs hits) {
        this.callQueryType = "vector";
        this.callSurrogateQueryText = null;
        this.callQueryVector = queryVector;
        this.callQueryId = null;
        this.callQueryText = null;
        this.callQueryK = k;
        this.callHits = hits;
        return this;
    }

    public InternalSearch setQueryByID(String id, int k) { return setQueryByID(id, k, null); }
    public InternalSearch setQueryByID(String id, int k, TopDocs hits) {
        this.callQueryType = "id";
        this.callSurrogateQueryText = null;
        this.callQueryVector = null;
        this.callQueryId = id;
        this.callQueryText = null;
        this.callQueryK = k;
        this.callHits = hits;
        return this;
    }

    public InternalSearch setQueryByText(String textQuery, int k) { return setQueryByText(textQuery, k, null); }
    public InternalSearch setQueryByText(String textQuery, int k, TopDocs hits) {
        this.callQueryType = "text";
        this.callSurrogateQueryText = null;
        this.callQueryVector = null;
        this.callQueryId = null;
        this.callQueryText = textQuery;
        this.callQueryK = k;
        this.callHits = hits;
        return this;
    }

    public SearchResults[] call() throws Exception {
        if (callQueryType == null)
            throw new Exception("Query type not set");

        switch (callQueryType) {
            case "surrogate":
                return searchBySurrogateText(callSurrogateQueryText, callQueryK, callHits);
            case "vector":
                return searchByVector(callQueryVector, callQueryK, callHits);
            case "id":
                return searchByID(callQueryId, callQueryK, callHits);
            case "text":
                return searchByText(callQueryText, callQueryK, callHits);
            default:
                throw new Exception("Invalid query type");
        }
    }
}
