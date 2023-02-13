package it.cnr.isti.visione;

import java.io.BufferedReader;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.Charset;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Iterator;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.zip.GZIPInputStream;

import org.apache.lucene.analysis.Analyzer;
import org.apache.lucene.analysis.TokenStream;
import org.apache.lucene.analysis.Tokenizer;
import org.apache.lucene.analysis.core.WhitespaceTokenizer;
import org.apache.lucene.analysis.miscellaneous.DelimitedTermFrequencyTokenFilter;
import org.apache.lucene.document.Document;
import org.apache.lucene.document.Field;
import org.apache.lucene.document.FieldType;
import org.apache.lucene.document.StoredField;
import org.apache.lucene.document.TextField;
import org.apache.lucene.index.DirectoryReader;
import org.apache.lucene.index.IndexOptions;
import org.apache.lucene.index.IndexReader;
import org.apache.lucene.index.IndexWriter;
import org.apache.lucene.index.IndexWriterConfig;
import org.apache.lucene.index.IndexWriterConfig.OpenMode;
import org.apache.lucene.index.Term;
import org.apache.lucene.search.IndexSearcher;
import org.apache.lucene.search.Query;
import org.apache.lucene.search.TermQuery;
import org.apache.lucene.store.FSDirectory;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonElement;

import me.tongfei.progressbar.ProgressBar;
import net.sourceforge.argparse4j.ArgumentParsers;
import net.sourceforge.argparse4j.impl.action.StoreTrueArgumentAction;
import net.sourceforge.argparse4j.inf.ArgumentParser;
import net.sourceforge.argparse4j.inf.Namespace;

public class IndexBuilder {

    /* Whitespace Analyzer + DelimitedTermFrequencyTokenFilter */
    protected static class TermFrequencyAnalyzer extends Analyzer {

        @Override
        protected TokenStreamComponents createComponents(String fieldName) {
            Tokenizer source = new WhitespaceTokenizer();
            TokenStream result = new DelimitedTermFrequencyTokenFilter(source);
            return new TokenStreamComponents(source, result);
        }

    }

    /* FieldType for Stored Searchable Fields */
    protected static FieldType storedTextFieldType = new FieldType(TextField.TYPE_STORED) {{
        setIndexOptions(IndexOptions.DOCS);
        setOmitNorms(true);
    }};

    /* FieldType for Surrogate Text Representation Fields */
    protected static FieldType surrogateTextFieldType = new FieldType(TextField.TYPE_NOT_STORED) {{
        setIndexOptions(IndexOptions.DOCS_AND_FREQS);
        setStoreTermVectors(true);
    }};

    public static void main(String[] args) throws IOException {
        ArgumentParser parser = ArgumentParsers.newFor("IndexBuilder").build()
                .defaultHelp(true)
                .description("Creates or adds to a Lucene index of a collection.");

        parser.addArgument("--save-every")
                .type(Integer.class)
                .setDefault(200)
                .help("commit index every this amount of indexed documents");

        parser.addArgument("-f", "--force")
                .action(new StoreTrueArgumentAction())
                .help("whether to replace existing document or skip insertion");

        parser.addArgument("documents_file").help("jsonl.gz file containing documents to be added");
        parser.addArgument("video_id").help("id of the video to which input documents belong");
        parser.addArgument("index_dir").help("directory in which the index is stored");
        Namespace ns = parser.parseArgsOrFail(args);

        int saveEvery = ns.getInt("save_every"); // TODO not used yet
        String documentsFile = ns.getString("documents_file");
        String videoId = ns.getString("video_id");
        String indexDirectory = ns.getString("index_dir");
        boolean force = ns.getBoolean("force");

        // open the index dir
        Path absolutePath = Paths.get(indexDirectory, "");
        FSDirectory index = FSDirectory.open(absolutePath);

        // skip if documents of this video already exists
        Term videoIdTerm = new Term("videoID", videoId);

        if (!force) {
            IndexReader reader = DirectoryReader.open(index);
            IndexSearcher searcher = new IndexSearcher(reader);

            Query query = new TermQuery(videoIdTerm);
            long hits = searcher.search(query, 1).totalHits;
            if (hits > 0) {
                System.out.println("Found " + hits + " documents for video '" + videoId + "': skipping...");
                return;
            }
        }

        // configure index writer
        Analyzer analyzer = new TermFrequencyAnalyzer(); // parses "term1|freq1 term2|freq2 ..."
        IndexWriterConfig conf = new IndexWriterConfig(analyzer);
        conf.setOpenMode(OpenMode.CREATE_OR_APPEND);

        try (
            // documents file
            InputStream fileStream = new FileInputStream(documentsFile);
            InputStream gzipStream = new GZIPInputStream(fileStream);
            Reader decoder = new InputStreamReader(gzipStream, Charset.forName("UTF-8"));
            BufferedReader buffered = new BufferedReader(decoder);
            Stream<String> lines = buffered.lines();
        ) {

            // iterates over json objects
            Stream<Document> documents = lines
                .map(line -> JsonParser.parseString(line).getAsJsonObject())  // lines to json objects
                .map(IndexBuilder::createDocument);
            
            Iterable<Document> documentsWithProgressBar = (Iterable<Document>) ProgressBar.wrap(documents, "Indexing")::iterator;

            int count = 0; // TODO
            try (IndexWriter writer = new IndexWriter(index, conf)) {
                writer.updateDocuments(videoIdTerm, documentsWithProgressBar);
            }
        }
    }

    protected static Document createDocument(JsonObject record) {
        Document doc = new Document();
        
        record.entrySet().stream()
            .map(IndexBuilder::getLuceneField)
            .filter(field -> field != null)
            .forEach(field -> doc.add(field));

        return doc;
    }

    protected static Field getLuceneField(Map.Entry<String,JsonElement> field) {
        String fieldName = field.getKey();
        JsonElement fieldValue = field.getValue();

        switch (fieldName) {
            // string stored and searchable fields
            case "imgID":
            case "videoID":
                return new Field(fieldName, fieldValue.getAsString(), storedTextFieldType);
            
            // stored int fields
            case "startframe":
            case "endframe":
            case "middleframe":
                return new StoredField(fieldName, fieldValue.getAsInt());
            
            // stored double fields
            case "starttime":
            case "endtime":
            case "middletime":
                return new StoredField(fieldName, fieldValue.getAsDouble());
            
            // indexed STR fields
            case "txt":
            case "objects":
            case "features":
            case "aladin":
            case "features_clip-openai-clip-vit-large-patch14_str":
            case "features_clip-laion-CLIP-ViT-H-14-laion2B-s32B-b79K_str":
                return new Field(fieldName, fieldValue.getAsString(), surrogateTextFieldType);
            
            // ignored fields
            case "":
                return null;
            
            // stored string field
            default:
                return new StoredField(fieldName, fieldValue.getAsString());
        }
    }
}
