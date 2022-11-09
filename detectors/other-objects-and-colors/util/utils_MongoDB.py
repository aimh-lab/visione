import yaml
import itertools
import re
import mmcv

from pymongo import MongoClient
from pymongo.errors import BulkWriteError
from tqdm import tqdm

def get_mongo_client(mongo_configfile):
    with open(mongo_configfile, 'r', encoding='utf-8') as f:
        cfg = yaml.safe_load(f)
    client = MongoClient(cfg['host'], username=cfg['username'], password=cfg['password'])
    return client

def grouper(iterable, n):
    """ Iterates an iterable in batches. E.g.,
        grouper([1, 2, 3, 4, 5], 2)  -->  [(1, 2), (3, 4), (5,)]
    """
    it = iter(iterable)
    while True:
        chunk_it = itertools.islice(it, n)
        try:
            first_el = next(chunk_it)
        except StopIteration:
            return
        yield itertools.chain((first_el,), chunk_it)

def save_in_mongo(input_FN, db_name, color_collection_name, collection_type, mongo_configfile='../visione_MongoDBConfig.yaml'):
    client=get_mongo_client(mongo_configfile)
    collection_name = f"{collection_type}.{color_collection_name}"
    # la collezione in cui inserire i dati
    collection = client[db_name][collection_name]
    collection_stats = client[db_name].command('collstats', collection_name)
    print('n. records in collection:', collection_stats['count'])

    # la lista di dict da inserire (qua è un generatore più che una lista)
    records = generate_records(input_FN,collection_type)

    # si fanno batch di record da inserire per fare bulk indexing e velocizzare (affossando la macchina di Paolo :D)
    batch_size = 1000
    batches_of_records = grouper(records, batch_size)

    # scorre i batch di record
    for batch in tqdm(batches_of_records, unit_scale=batch_size):
        try:
            # si inserisce un batch; questa chiamata solleva un'eccezione alla fine dell'indicizzazione se qualche
            # record non è stato inserito, solitamente se è già presente nella collezione (stesso _id)
            collection.insert_many(batch, ordered=False)
        except BulkWriteError:
            # ignoro eventuali fallimenti di inserimento dei record già esistenti
            print('Duplicate entries discarded.')

    # stampa il numero di oggetti nella collezione
    collection_stats = client[db_name].command('collstats',collection_name)
    print('n. records in collection:', collection_stats['count'])

def generate_records(filepath,collection_type):
    if collection_type=='colors':
        return(generate_records_colors(filepath))
    elif collection_type=='objects':
        return(generate_records_objs(filepath))
    else:
        raise Exception(f"ERR: collection_type {collection_type} non supported yet")

def generate_records_colors(filepath):
    """ Generatore dei vostri records. Ogni record è un dict. """
    with open(filepath, 'r') as f:
        for line in f:
            line_split = line.strip().split(';')
            filename = line_split[0]

            if 'MarineVideoKit' in filename:
                id_video_id_frame=filename.split('/')[-1]
                id_img = filename.split('/')[-2]+'_'+id_video_id_frame
                video_id = filename.split('/')[-2]+'_'+id_video_id_frame.split('_')[0]
            else:
                id_img = filename.split('/')[-1]
                video_id = id_img.split('_')[0]
            image_cells = line_split[1:]
            color_scores = []
            color_boxes_yxyx = []
            color_class_names = []
            for i, cell in enumerate(image_cells):
                irow = i // 7
                icol = i % 7
                step = 1.0 / 7
                bbox = [irow * step, icol * step, (irow + 1) * step, (icol + 1) * step]  # [ymin, xmin, ymax, xmax]
                cell_split = cell.split(',')
                if (len(cell_split) > 1):
                    color_scores.extend(float(score) for score in cell_split[::2])
                    color_boxes_yxyx.extend(bbox for i, _ in enumerate(cell_split[::2]))
                    color_class_names.extend(color for color in cell_split[1::2])

            record = {
                # useful ids
                '_id': id_img,  # '17235_1.jpg',  # '_id' è indicizzato automaticamente da Mongo,
                # quindi è il campo da usare per fare retrival
                # veloce delle info di un frame.

                'video_id': video_id,
                # '17235',  # ho messo questo riferimento al video, pensavo di fare un'altra collezione
                # in Mongo dove inserire le info del video, e questa potrebbe essere l'_id
                # in quella collezione.
                # frame size
                # 'width': 1920,
                # 'height': 1080,  # width e height le ho messe in questa collezione perchè le avevo già,
                # ma andrebbero messe in una collezione separata con le info generiche
                # dell'immagine o del video, non vi consiglio di metterle di nuovo in mongo
                # nella vostra collezione che conterrà gli oggetti/bbox.

                # detection fields
                'object_scores': color_scores,
                # [0.36, 0.65, 0.46, 0.98],  # lista di detection score per ogni oggetto.

                'object_boxes_yxyx': color_boxes_yxyx,
                #   [[0.01, 0.142, 0.42, 0.64],
                # # lista di bbox; ho inserito col formato dato dal modello,
                # [0.02, 0.014, 0.56, 0.68],  # che sarebbe:  [ymin, xmin, ymax, xmax]
                # [0.015, 0.04, 0.67, 0.89],  # con coordinate NORMALIZZATE tra 0 e 1.
                # [0.027, 0.21, 0.58, 0.68]],

                'object_class_names': color_class_names,  # ['bus', 'cat', 'cat', 'house'],
                # lista di nomi delle classi openimages per ogni oggetto

                # queste invece sono info specifiche del mio modello,
                # potete trascurarle o inserire altri campi specifici al vostro modello,
                # tanto lo spazio disco è di Paolo :D
                # 'object_class_labels': [64, 2, 2, 53],
                # lista di indici delle classi di openimages per ogni oggetto
                # 'object_class_entities': ['/blablabus', '/blablacat', '/blablacat', '/blablahouse'],
                # lista di codici Freebase delle classi openimages per ogni oggetto
            }

            yield record

def generate_records_objs(filepath):
    """ Generatore dei vostri records. Ogni record è un dict. """
    with open(filepath, 'r') as f:
        line = f.readline().strip()
        while True:
            if len(line) == 0:
                break  # end file
            if re.match('^[a-zA-Z]:', line) is not None:
                # new image
                filename = line
                if 'MarineVideoKit' in filename:
                    id_video_id_frame = filename.split('/')[-1]
                    id_img = filename.split('/')[-2] + '_' + id_video_id_frame
                    video_id = filename.split('/')[-2] + '_' + id_video_id_frame.split('_')[0]
                else:
                    id_img = filename.split('/')[-1]
                    video_id = id_img.split('_')[0]

                control = True

                img = mmcv.imread(filename)
                mywidth = img.shape[1]
                myheight = img.shape[0]

                object_scores = []
                object_boxes_yxyx = []
                object_class_names = []
                while control:
                    line = f.readline().strip()
                    if len(line) == 0:
                        break  # end file
                    if re.match('^[a-zA-Z]:', line) is not None:
                        control = False
                    else:
                        lsplit = line.split(',')
                        object_class = lsplit[0]
                        score = float(lsplit[1])
                        bbox = lsplit[2:]  # [leftx,topy,rightx,bottomy]=[xmin,ymin,xmax,ymax]=[0,1,2,3]
                        bboxNEW = [float(bbox[1]) / myheight, float(bbox[0]) / mywidth, float(bbox[3]) / myheight,
                                   float(bbox[2]) / mywidth]
                        # [ymin, xmin, ymax, xmax]

                        object_scores.append(score)
                        object_boxes_yxyx.append(bboxNEW)
                        object_class_names.append(object_class)
                record = {
                    # useful ids
                    '_id': id_img,  # '17235_1.jpg',  # '_id' è indicizzato automaticamente da Mongo,
                    # quindi è il campo da usare per fare retrival
                    # veloce delle info di un frame.

                    'video_id': video_id,
                    # '17235',  # ho messo questo riferimento al video, pensavo di fare un'altra collezione
                    # in Mongo dove inserire le info del video, e questa potrebbe essere l'_id
                    # in quella collezione.
                    # frame size
                    'width': mywidth,
                    'height': myheight,  # width e height le ho messe in questa collezione perchè le avevo già,
                    # ma andrebbero messe in una collezione separata con le info generiche
                    # dell'immagine o del video, non vi consiglio di metterle di nuovo in mongo
                    # nella vostra collezione che conterrà gli oggetti/bbox.

                    # detection fields
                    'object_scores': object_scores,
                    # [0.36, 0.65, 0.46, 0.98],  # lista di detection score per ogni oggetto.

                    'object_boxes_yxyx': object_boxes_yxyx,
                    #   [[0.01, 0.142, 0.42, 0.64],
                    # # lista di bbox; ho inserito col formato dato dal modello,
                    # [0.02, 0.014, 0.56, 0.68],  # che sarebbe:  [ymin, xmin, ymax, xmax]
                    # [0.015, 0.04, 0.67, 0.89],  # con coordinate NORMALIZZATE tra 0 e 1.
                    # [0.027, 0.21, 0.58, 0.68]],

                    'object_class_names': object_class_names,  # ['bus', 'cat', 'cat', 'house'],
                    # lista di nomi delle classi openimages per ogni oggetto

                    # queste invece sono info specifiche del mio modello,
                    # potete trascurarle o inserire altri campi specifici al vostro modello,
                    # tanto lo spazio disco è di Paolo :D
                    # 'object_class_labels': [64, 2, 2, 53],
                    # lista di indici delle classi di openimages per ogni oggetto
                    # 'object_class_entities': ['/blablabus', '/blablacat', '/blablacat', '/blablahouse'],
                    # lista di codici Freebase delle classi openimages per ogni oggetto
                }

                yield record


def print_record(db_name,collection_name,mongo_configfile='../visione_MongoDBConfig.yaml'):
    """ Vi lascio in questa funzione un esempio per cercare e stampare un record in Mongo. """
    from pprint import pprint  # pretty-print dict
    client=get_mongo_client(mongo_configfile)

    collection = client[db_name][f'{collection_name}']

    query = {'_id': '04375_10.jpg'} #17235_1 #'04375_10.jpg'
    record = collection.find_one(query)

    pprint(record)
    collection_stats = client[db_name].command('collstats',f'{collection_name}')
    print('n. records in collection:', collection_stats['count'])

def remove_collection(db_name,collection_name,mongo_configfile='../visione_MongoDBConfig.yaml'):
    """ Vi lascio in questa funzione un esempio per cercare e stampare un record in Mongo. """

    client=get_mongo_client(mongo_configfile)

    db=client[db_name]
    collection = db[f'{collection_name}']
    response = db.drop_collection(f'{collection_name}')
    print("\n", "drop_collection() response:", response)
    if 'errmsg' in response:
    # e.g. 'ns not found'
        print ("drop_collection() ERROR:", response['errmsg'])
    elif 'ns' in response:
        print ("the collection:", response['ns'], "is dropped.")

if __name__ == "__main__":
    collection_name = 'colorAnnotation_UNION'  # 'mask_rcnn_lvis'  #
    dataset = 'V3C1'
    input_FN = f'Z:/VBS/descriptors_feature_extracted/colorAnnotation/{dataset}{collection_name}.txt'
    color_collection_name=f'objects.{collection_name}'
    #save_in_mongo(input_FN, dataset.lower(), color_collection_name, 'colors')
   # print_record(dataset.lower(), color_collection_name)
    # remove_collection(dataset.lower(), color_collection_name)
    #   print_record(dataset.lower(), color_collection_name)